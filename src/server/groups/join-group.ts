import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { hashInviteToken } from "@/server/groups/invite-member";

// SPEC §4.1 — accepting either an email-invite token or a shareable-link
// token. We disambiguate by token-hash lookup: try the email-invite table
// first (single-use, identified by email), then fall back to the shareable
// link table (multi-use, capped by maxUses + 7-day TTL + 10/hr rate limit).

const MAX_GROUP_MEMBERS = 50;
const LINK_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LINK_RATE_MAX = 10; // 10 joins per hour per link

export interface JoinResult {
  groupId: string;
  groupName: string;
  via: "email-invite" | "invite-link";
}

export async function joinViaInviteLink(
  userId: string,
  rawToken: string,
): Promise<JoinResult> {
  if (!rawToken || rawToken.length < 10) {
    throw new AppError("VALIDATION_ERROR", "Invalid invite token.");
  }

  const tokenHash = hashInviteToken(rawToken);

  const emailInvite = await prisma.groupInvite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      groupId: true,
      invitedEmail: true,
      status: true,
      expiresAt: true,
      group: { select: { id: true, name: true, deletedAt: true } },
    },
  });
  if (emailInvite) {
    return acceptEmailInvite(userId, emailInvite);
  }

  const linkInvite = await prisma.groupInviteLink.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      groupId: true,
      maxUses: true,
      usedCount: true,
      expiresAt: true,
      revokedAt: true,
      group: { select: { id: true, name: true, deletedAt: true } },
    },
  });
  if (linkInvite) {
    return acceptInviteLink(userId, linkInvite);
  }

  throw new AppError("NOT_FOUND", "This invite is invalid or has been revoked.");
}

interface EmailInviteRow {
  id: string;
  groupId: string;
  invitedEmail: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expiresAt: Date;
  group: { id: string; name: string; deletedAt: Date | null };
}

async function acceptEmailInvite(
  userId: string,
  invite: EmailInviteRow,
): Promise<JoinResult> {
  if (!invite.group || invite.group.deletedAt) {
    throw new AppError("NOT_FOUND", "This invite's group is no longer available.");
  }
  if (invite.status !== "PENDING") {
    throw new AppError("CONFLICT", "This invite has already been used.");
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    await prisma.groupInvite
      .update({ where: { id: invite.id }, data: { status: "EXPIRED" } })
      .catch(() => undefined);
    throw new AppError("CONFLICT", "This invite has expired.");
  }

  const memberCount = await prisma.groupMember.count({
    where: { groupId: invite.groupId },
  });
  if (memberCount >= MAX_GROUP_MEMBERS) {
    throw new AppError(
      "CONFLICT",
      `This group is full (${MAX_GROUP_MEMBERS} members).`,
    );
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: invite.groupId, userId } },
    select: { id: true },
  });
  if (existing) {
    // Mark the invite consumed so the link doesn't dangle, but tell the
    // caller they were already in.
    await prisma.groupInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByUserId: userId },
    });
    throw new AppError(
      "CONFLICT",
      "You're already a member of this group.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.create({
      data: {
        groupId: invite.groupId,
        userId,
        role: "MEMBER",
      },
    });
    await tx.groupInvite.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedByUserId: userId,
      },
    });
    await tx.auditLog.create({
      data: {
        groupId: invite.groupId,
        actorId: userId,
        entityType: "MEMBER",
        entityId: userId,
        action: "CREATED",
        newValue: { userId, role: "MEMBER", via: "email-invite", inviteId: invite.id },
      },
    });
  });

  return {
    groupId: invite.groupId,
    groupName: invite.group.name,
    via: "email-invite",
  };
}

interface LinkInviteRow {
  id: string;
  groupId: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  revokedAt: Date | null;
  group: { id: string; name: string; deletedAt: Date | null };
}

async function acceptInviteLink(
  userId: string,
  link: LinkInviteRow,
): Promise<JoinResult> {
  if (!link.group || link.group.deletedAt) {
    throw new AppError("NOT_FOUND", "This invite's group is no longer available.");
  }
  if (link.revokedAt) {
    throw new AppError("CONFLICT", "This invite link has been revoked.");
  }
  if (link.expiresAt.getTime() <= Date.now()) {
    throw new AppError("CONFLICT", "This invite link has expired.");
  }
  if (link.usedCount >= link.maxUses) {
    throw new AppError("CONFLICT", "This invite link has reached its use limit.");
  }

  // Per SPEC: 10 joins per hour per link. The in-memory limiter is the same
  // bucket pattern used by auth — keyed on the link id so a single link can't
  // be used as a brute-force vector while individual users still get fair
  // access across links.
  if (
    !consumeRateLimit(`invite-link:${link.id}`, {
      max: LINK_RATE_MAX,
      windowMs: LINK_RATE_WINDOW_MS,
    })
  ) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many people have used this link recently. Try again later.",
    );
  }

  const memberCount = await prisma.groupMember.count({
    where: { groupId: link.groupId },
  });
  if (memberCount >= MAX_GROUP_MEMBERS) {
    throw new AppError(
      "CONFLICT",
      `This group is full (${MAX_GROUP_MEMBERS} members).`,
    );
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: link.groupId, userId } },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "CONFLICT",
      "You're already a member of this group.",
    );
  }

  await prisma.$transaction(async (tx) => {
    // Atomically claim a slot on the link FIRST. The pre-check above
    // (`link.usedCount >= link.maxUses`) is racy on its own — two parallel
    // joins could both pass the read and then both increment past the cap.
    // The conditional updateMany acts as a compare-and-swap: only one of
    // the two writers will see `count = 1` and the other gets `count = 0`,
    // which we surface as CONFLICT. Also re-checks revoked/expired so a
    // race against admin actions can't slip through either.
    const claim = await tx.groupInviteLink.updateMany({
      where: {
        id: link.id,
        usedCount: { lt: link.maxUses },
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedCount: { increment: 1 } },
    });
    if (claim.count === 0) {
      throw new AppError("CONFLICT", "Invite link is no longer valid.");
    }
    await tx.groupMember.create({
      data: {
        groupId: link.groupId,
        userId,
        role: "MEMBER",
      },
    });
    await tx.auditLog.create({
      data: {
        groupId: link.groupId,
        actorId: userId,
        entityType: "MEMBER",
        entityId: userId,
        action: "CREATED",
        newValue: { userId, role: "MEMBER", via: "invite-link", linkId: link.id },
      },
    });
  });

  return {
    groupId: link.groupId,
    groupName: link.group.name,
    via: "invite-link",
  };
}
