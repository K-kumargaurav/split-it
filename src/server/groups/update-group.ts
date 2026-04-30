import { z } from "zod";
import type { Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  balanceModeSchema,
  groupColorSchema,
  groupDescriptionSchema,
  groupIconSchema,
  groupNameSchema,
} from "@/lib/validations/groups";

// SPEC §4.1 — group settings update. Members can edit name/description/
// color/icon; only the owner can flip balanceMode (it materially changes how
// every member sees their debt graph). Currency is intentionally locked once
// expenses exist, so we never accept it here.

export const updateGroupSchema = z
  .object({
    name: groupNameSchema.optional(),
    description: groupDescriptionSchema.nullable().optional(),
    color: groupColorSchema.nullable().optional(),
    icon: groupIconSchema.nullable().optional(),
    balanceMode: balanceModeSchema.optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.description !== undefined ||
      v.color !== undefined ||
      v.icon !== undefined ||
      v.balanceMode !== undefined,
    { message: "Provide at least one field to update." },
  );

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export interface UpdatedGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  balanceMode: "DIRECT" | "SIMPLIFIED";
  status: "ACTIVE" | "ARCHIVED";
}

export async function updateGroup(
  userId: string,
  groupId: string,
  rawInput: unknown,
): Promise<UpdatedGroup> {
  const parsed = updateGroupSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Some fields are invalid.",
      parsed.error.issues.map((i) => ({
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    );
  }
  const input = parsed.data;

  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true, ownerId: true, status: true },
  });
  if (!group) {
    throw new AppError("NOT_FOUND", "Group not found.");
  }
  if (group.status !== "ACTIVE") {
    throw new AppError("CONFLICT", "Archived groups can't be edited.");
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }

  const isOwner = group.ownerId === userId;
  if (input.balanceMode !== undefined && !isOwner) {
    throw new AppError(
      "FORBIDDEN",
      "Only the group owner can change the balance mode.",
    );
  }

  const data: Prisma.GroupUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.color !== undefined) data.color = input.color;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.balanceMode !== undefined) data.balanceMode = input.balanceMode;

  const updated = await prisma.group.update({
    where: { id: groupId },
    data,
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      icon: true,
      balanceMode: true,
      status: true,
    },
  });

  return updated;
}

// SPEC §4.1 — archiving is the soft-delete path: set status to ARCHIVED so
// the group disappears from active lists but balances/expenses stay readable.
// Pending settlements would create stale liability so we refuse until they
// are resolved.
export async function archiveGroup(userId: string, groupId: string): Promise<void> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true, ownerId: true, status: true },
  });
  if (!group) throw new AppError("NOT_FOUND", "Group not found.");
  if (group.ownerId !== userId) {
    throw new AppError("FORBIDDEN", "Only the group owner can archive the group.");
  }
  if (group.status === "ARCHIVED") {
    throw new AppError("CONFLICT", "Group is already archived.");
  }

  const pending = await prisma.settlement.count({
    where: {
      groupId,
      status: "PENDING_CONFIRMATION",
      deletedAt: null,
    },
  });
  if (pending > 0) {
    throw new AppError(
      "CONFLICT",
      "Resolve pending settlements before archiving the group.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.group.update({
      where: { id: groupId },
      data: { status: "ARCHIVED" },
    });
    await tx.auditLog.create({
      data: {
        groupId,
        actorId: userId,
        entityType: "GROUP",
        entityId: groupId,
        action: "DELETED",
        newValue: { status: "ARCHIVED" },
      },
    });
  });
}
