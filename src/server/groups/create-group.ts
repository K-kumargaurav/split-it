import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createGroupSchema, type CreateGroupInput } from "@/lib/validations/groups";

// SPEC §4.4 — every group is seeded with these system categories at creation
// so members can categorise expenses immediately. Custom categories live in
// the same table, scoped by `groupId`, with `isSystem = false`.
const DEFAULT_CATEGORIES: { name: string; emoji: string }[] = [
  { name: "Food", emoji: "🍽️" },
  { name: "Travel", emoji: "✈️" },
  { name: "Accommodation", emoji: "🏠" },
  { name: "Utilities", emoji: "💡" },
  { name: "Entertainment", emoji: "🎬" },
  { name: "Other", emoji: "📦" },
];

// Per CLAUDE.md "Group size: up to 50 members". The 10-groups-per-user cap is
// from SPEC §4.1 — counts only ACTIVE groups, archived/deleted don't apply.
const MAX_GROUPS_PER_USER = 10;

// Returned shape — used by the API route and the new-group form. Members
// included so the UI can render the (currently 1-member) list immediately
// after creation without a follow-up fetch.
export type CreatedGroup = Prisma.GroupGetPayload<{
  include: {
    members: {
      select: {
        id: true;
        role: true;
        joinedAt: true;
        user: { select: { id: true; handle: true; displayName: true; avatarUrl: true } };
      };
    };
  };
}>;

export async function createGroup(
  userId: string,
  rawInput: unknown,
): Promise<CreatedGroup> {
  const parsed = createGroupSchema.safeParse(rawInput);
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

  // Cap is enforced before opening the transaction so we don't waste a write
  // on a request that will never succeed. The transaction below re-checks to
  // close the (very narrow) race where a user creates two groups in parallel.
  const activeOwned = await countActiveOwnedGroups(userId);
  if (activeOwned >= MAX_GROUPS_PER_USER) {
    throw new AppError(
      "CONFLICT",
      `You can have at most ${MAX_GROUPS_PER_USER} active groups.`,
    );
  }

  return runCreateTransaction(userId, parsed.data);
}

async function countActiveOwnedGroups(userId: string): Promise<number> {
  return prisma.group.count({
    where: {
      ownerId: userId,
      status: "ACTIVE",
      deletedAt: null,
    },
  });
}

async function runCreateTransaction(
  userId: string,
  input: CreateGroupInput,
): Promise<CreatedGroup> {
  return prisma.$transaction(async (tx) => {
    const reCheck = await tx.group.count({
      where: { ownerId: userId, status: "ACTIVE", deletedAt: null },
    });
    if (reCheck >= MAX_GROUPS_PER_USER) {
      throw new AppError(
        "CONFLICT",
        `You can have at most ${MAX_GROUPS_PER_USER} active groups.`,
      );
    }

    const group = await tx.group.create({
      data: {
        name: input.name,
        description: input.description,
        currency: input.currency,
        color: input.color,
        icon: input.icon,
        balanceMode: input.balanceMode,
        ownerId: userId,
        members: {
          create: { userId, role: "OWNER" },
        },
        categories: {
          create: DEFAULT_CATEGORIES.map((c) => ({
            name: c.name,
            emoji: c.emoji,
            isSystem: true,
          })),
        },
      },
      include: {
        members: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: {
              select: { id: true, handle: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return group;
  });
}
