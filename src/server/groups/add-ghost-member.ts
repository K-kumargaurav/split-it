import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  addGhostMemberSchema,
  type AddGhostMemberInput,
} from "@/lib/validations/ghost-members";

// SPEC §4.6 — add a guest user without an account. The inviter generates a
// 32-byte token; the raw token IS the credential and is stored as-is on
// `ghost_members.guestToken` (already random enough — there's nothing to
// guess against, no rainbow-table risk for a 256-bit value). We don't hash
// it because the guest needs to present the token via URL on every visit
// and we have no second factor to compare against.

const TOKEN_BYTES = 32;
const MAX_GROUP_OCCUPANTS = 50;

export interface AddedGhostMember {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  guestToken: string;
  guestPath: string;
  createdAt: Date;
}

export async function addGhostMember(
  userId: string,
  groupId: string,
  rawInput: unknown,
): Promise<AddedGhostMember> {
  const parsed = addGhostMemberSchema.safeParse(rawInput);
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
  const input: AddGhostMemberInput = parsed.data;

  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!group) {
    throw new AppError("NOT_FOUND", "Group not found.");
  }
  if (group.status !== "ACTIVE") {
    throw new AppError("CONFLICT", "Archived groups can't accept new members.");
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }

  // §4.1 capacity rule — the 50-member cap counts BOTH real and ghost
  // occupants so a group can't grow unboundedly by adding guests.
  const [memberCount, ghostCount] = await Promise.all([
    prisma.groupMember.count({ where: { groupId } }),
    prisma.ghostMember.count({ where: { groupId, status: "ACTIVE" } }),
  ]);
  if (memberCount + ghostCount >= MAX_GROUP_OCCUPANTS) {
    throw new AppError(
      "CONFLICT",
      `This group is full (${MAX_GROUP_OCCUPANTS} members).`,
    );
  }

  const guestToken = randomBytes(TOKEN_BYTES).toString("hex");

  const ghost = await prisma.$transaction(async (tx) => {
    const created = await tx.ghostMember.create({
      data: {
        groupId,
        displayName: input.displayName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        guestToken,
        status: "ACTIVE",
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        guestToken: true,
        createdAt: true,
      },
    });
    await tx.auditLog.create({
      data: {
        groupId,
        actorId: userId,
        entityType: "MEMBER",
        entityId: created.id,
        action: "CREATED",
        newValue: {
          via: "ghost-add",
          displayName: created.displayName,
          email: created.email,
          phone: created.phone,
        },
      },
    });
    return created;
  });

  return {
    id: ghost.id,
    displayName: ghost.displayName,
    email: ghost.email,
    phone: ghost.phone,
    guestToken: ghost.guestToken,
    guestPath: `/guest/${ghost.guestToken}`,
    createdAt: ghost.createdAt,
  };
}

export const __testing = {
  MAX_GROUP_OCCUPANTS,
  TOKEN_BYTES,
};
