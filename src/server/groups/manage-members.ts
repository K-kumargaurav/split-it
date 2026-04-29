import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

// Read + remove flows for the members page. Owner-gating lives here so the
// route handlers stay thin; leaving a group is a self-service action and
// uses the same removal core, just keyed on `actorId === targetUserId`.

export interface MemberRow {
  membershipId: string;
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  role: "OWNER" | "MEMBER";
  joinedAt: Date;
}

export interface MemberListResult {
  members: MemberRow[];
  viewerRole: "OWNER" | "MEMBER";
  ownerId: string;
}

export async function getGroupMembers(
  userId: string,
  groupId: string,
): Promise<MemberListResult> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      id: true,
      ownerId: true,
      members: {
        select: {
          id: true,
          role: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      },
    },
  });
  if (!group) {
    throw new AppError("NOT_FOUND", "Group not found.");
  }
  const viewer = group.members.find((m) => m.user.id === userId);
  if (!viewer) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }

  const members: MemberRow[] = group.members.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    handle: m.user.handle,
    displayName: m.user.displayName,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
    joinedAt: m.joinedAt,
  }));

  return {
    members,
    viewerRole: viewer.role,
    ownerId: group.ownerId,
  };
}

export async function removeMember(
  actorId: string,
  groupId: string,
  targetUserId: string,
): Promise<void> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!group) throw new AppError("NOT_FOUND", "Group not found.");

  const isSelfLeave = actorId === targetUserId;
  if (!isSelfLeave && group.ownerId !== actorId) {
    throw new AppError(
      "FORBIDDEN",
      "Only the group owner can remove other members.",
    );
  }

  // Owner can't be removed by anyone (including themselves) until ownership
  // is transferred — preserves the §4.1 "owner can transfer ownership" path
  // without leaving an ownerless group behind.
  if (targetUserId === group.ownerId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "The owner can't leave or be removed. Transfer ownership first.",
    );
  }

  const target = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    select: { id: true },
  });
  if (!target) {
    throw new AppError("NOT_FOUND", "That member is not in this group.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({ where: { id: target.id } });
    await tx.auditLog.create({
      data: {
        groupId,
        actorId,
        entityType: "MEMBER",
        entityId: targetUserId,
        action: "DELETED",
        oldValue: { userId: targetUserId } satisfies Prisma.InputJsonValue,
        newValue: { via: isSelfLeave ? "self-leave" : "owner-remove" },
      },
    });
    if (!isSelfLeave) {
      await tx.notification.create({
        data: {
          userId: targetUserId,
          type: "MEMBERSHIP_CHANGED",
          title: "Removed from group",
          body: "You've been removed from a SplitEasy group.",
          entityType: "GROUP",
          entityId: groupId,
        },
      });
    }
  });
}
