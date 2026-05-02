import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { sendGroupInviteEmail } from "@/server/email/auth-emails";
import {
  INVITE_LINK_DEFAULT_MAX_USES,
  INVITE_LINK_MAX_USES_CAP,
} from "@/lib/validations/invites";
import { dispatchExternal } from "@/server/notifications/create-notification";

// SPEC §4.1: invite by email or by shareable link. Both flows use the same
// 32-byte random token; only the SHA-256 hash hits the DB so a snapshot leak
// does not yield active links. Email invites expire in 7 days; shareable
// links also expire in 7 days regardless of remaining uses.

const TOKEN_BYTES = 32;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_GROUP_MEMBERS = 50;

function generateRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface InviteByEmailResult {
  status: "ADDED_DIRECTLY" | "INVITE_SENT";
  member?: {
    userId: string;
    handle: string;
    displayName: string;
  };
  invite?: {
    id: string;
    email: string;
    expiresAt: Date;
  };
}

export async function inviteMemberByEmail(
  ownerId: string,
  groupId: string,
  rawEmail: string,
): Promise<InviteByEmailResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Email is required.",
      [{ path: ["email"], message: "Email is required." }],
    );
  }

  const group = await loadGroupForInvite(groupId);
  await assertViewerIsMember(ownerId, groupId);
  assertCapacity(group);

  const existingUser = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: {
      id: true,
      handle: true,
      displayName: true,
      email: true,
    },
  });

  // Existing user: short-circuit to a direct membership add. Per §4.1 the
  // invitee must "register or already have an account"; if they already have
  // one, no email round-trip is necessary.
  if (existingUser) {
    return addExistingUser({
      ownerId,
      groupId,
      userId: existingUser.id,
      handle: existingUser.handle,
      displayName: existingUser.displayName,
    });
  }

  return createPendingEmailInvite({
    ownerId,
    groupId,
    groupName: group.name,
    email,
  });
}

interface LoadedGroup {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
}

async function loadGroupForInvite(groupId: string): Promise<LoadedGroup> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      id: true,
      name: true,
      ownerId: true,
      _count: { select: { members: true } },
    },
  });
  if (!group) {
    throw new AppError("NOT_FOUND", "Group not found.");
  }
  return {
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    memberCount: group._count.members,
  };
}

async function assertViewerIsMember(userId: string, groupId: string): Promise<void> {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!m) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }
}

function assertCapacity(group: LoadedGroup): void {
  // Per §4.1 — invitations and direct adds are blocked once the group has 50
  // members, regardless of which flow the inviter uses.
  if (group.memberCount >= MAX_GROUP_MEMBERS) {
    throw new AppError(
      "VALIDATION_ERROR",
      `This group is full (${MAX_GROUP_MEMBERS} members).`,
    );
  }
}

interface AddExistingArgs {
  ownerId: string;
  groupId: string;
  userId: string;
  handle: string;
  displayName: string;
}

async function addExistingUser(args: AddExistingArgs): Promise<InviteByEmailResult> {
  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: args.groupId, userId: args.userId } },
    select: { id: true },
  });
  if (existingMember) {
    throw new AppError(
      "CONFLICT",
      "This user is already a member of the group.",
    );
  }

  await prisma.$transaction(async (tx) => {
    // Re-count inside the transaction to close the TOCTOU window between the
    // pre-read in `loadGroupForInvite` and the actual insert. Two concurrent
    // invitations could both see memberCount = 49 and both succeed, pushing
    // the group to 51. The re-count here is serialized within the transaction
    // so only one writer can increment past the cap.
    const currentCount = await tx.groupMember.count({
      where: { groupId: args.groupId },
    });
    if (currentCount >= MAX_GROUP_MEMBERS) {
      throw new AppError(
        "CONFLICT",
        `This group is full (${MAX_GROUP_MEMBERS} members).`,
      );
    }

    await tx.groupMember.create({
      data: {
        groupId: args.groupId,
        userId: args.userId,
        role: "MEMBER",
      },
    });
    await tx.auditLog.create({
      data: {
        groupId: args.groupId,
        actorId: args.ownerId,
        entityType: "MEMBER",
        entityId: args.userId,
        action: "CREATED",
        newValue: { userId: args.userId, role: "MEMBER", via: "direct-add" },
      },
    });
    await tx.notification.create({
      data: {
        userId: args.userId,
        type: "MEMBERSHIP_CHANGED",
        title: "Added to a group",
        body: `You've been added to a SplitEasy group.`,
        entityType: "GROUP",
        entityId: args.groupId,
      },
    });
  });

  void dispatchExternal([args.userId], {
    type: "MEMBERSHIP_CHANGED",
    title: "Added to a group",
    body: `You've been added to a SplitEasy group.`,
    entityType: "GROUP",
    entityId: args.groupId,
  });

  return {
    status: "ADDED_DIRECTLY",
    member: {
      userId: args.userId,
      handle: args.handle,
      displayName: args.displayName,
    },
  };
}

interface CreatePendingArgs {
  ownerId: string;
  groupId: string;
  groupName: string;
  email: string;
}

async function createPendingEmailInvite(
  args: CreatePendingArgs,
): Promise<InviteByEmailResult> {
  // Refuse if there's already a PENDING invite for the same (group, email) —
  // the recipient would otherwise receive duplicate links and we'd retain
  // multiple live tokens. Re-issuing should go through revoke + send.
  const existing = await prisma.groupInvite.findFirst({
    where: {
      groupId: args.groupId,
      invitedEmail: args.email,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "CONFLICT",
      "An invitation has already been sent to this email.",
    );
  }

  const rawToken = generateRawToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const inviter = await prisma.user.findUnique({
    where: { id: args.ownerId },
    select: { displayName: true, handle: true },
  });
  const inviterName = inviter?.displayName ?? `@${inviter?.handle ?? "someone"}`;

  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.groupInvite.create({
      data: {
        groupId: args.groupId,
        invitedEmail: args.email,
        invitedById: args.ownerId,
        tokenHash,
        expiresAt,
        status: "PENDING",
      },
      select: { id: true, invitedEmail: true, expiresAt: true },
    });
    await tx.auditLog.create({
      data: {
        groupId: args.groupId,
        actorId: args.ownerId,
        entityType: "MEMBER",
        entityId: created.id,
        action: "CREATED",
        newValue: {
          invitedEmail: args.email,
          via: "email-invite",
          expiresAt: created.expiresAt,
        },
      },
    });
    return created;
  });

  // Best-effort send. If SMTP is misconfigured we still want the invite row to
  // exist (the link can be re-sent), but we surface the failure so callers
  // don't think the recipient got the email.
  await sendGroupInviteEmail({
    to: args.email,
    inviterName,
    groupName: args.groupName,
    rawToken,
    ttlDays: 7,
  });

  return {
    status: "INVITE_SENT",
    invite: {
      id: invite.id,
      email: invite.invitedEmail,
      expiresAt: invite.expiresAt,
    },
  };
}

export interface GeneratedInviteLink {
  id: string;
  rawToken: string;
  maxUses: number;
  expiresAt: Date;
}

export async function generateInviteLink(
  userId: string,
  groupId: string,
  input: { maxUses?: number },
): Promise<GeneratedInviteLink> {
  await assertViewerIsMember(userId, groupId);
  const group = await loadGroupForInvite(groupId);
  assertCapacity(group);

  const requested = input.maxUses ?? INVITE_LINK_DEFAULT_MAX_USES;
  if (!Number.isInteger(requested) || requested < 1) {
    throw new AppError(
      "VALIDATION_ERROR",
      "maxUses must be a positive integer.",
      [{ path: ["maxUses"], message: "Provide a positive integer." }],
    );
  }
  if (requested > INVITE_LINK_MAX_USES_CAP) {
    throw new AppError(
      "VALIDATION_ERROR",
      `maxUses cannot exceed ${INVITE_LINK_MAX_USES_CAP}.`,
      [
        {
          path: ["maxUses"],
          message: `Maximum is ${INVITE_LINK_MAX_USES_CAP}.`,
        },
      ],
    );
  }

  const rawToken = generateRawToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const link = await prisma.$transaction(async (tx) => {
    const created = await tx.groupInviteLink.create({
      data: {
        groupId,
        createdById: userId,
        tokenHash,
        maxUses: requested,
        usedCount: 0,
        expiresAt,
      },
      select: { id: true, maxUses: true, expiresAt: true },
    });
    await tx.auditLog.create({
      data: {
        groupId,
        actorId: userId,
        entityType: "GROUP",
        entityId: created.id,
        action: "CREATED",
        newValue: {
          via: "invite-link",
          maxUses: created.maxUses,
          expiresAt: created.expiresAt,
        },
      },
    });
    return created;
  });

  return {
    id: link.id,
    rawToken,
    maxUses: link.maxUses,
    expiresAt: link.expiresAt,
  };
}

export const __testing = {
  hashInviteToken,
  MAX_GROUP_MEMBERS,
  INVITE_TTL_MS,
};
