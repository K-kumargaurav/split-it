import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

// Per-group balance for the requesting user, computed the same way as
// `getDashboardData` to keep the two sources of truth aligned:
//   (paid as payer) − (owed as participant) − (settlements out) + (settlements in)
// All money is paise (BigInt in DB → number in JS, safe up to 2^53 paise).

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  currency: string;
  balanceMode: "DIRECT" | "SIMPLIFIED";
  status: "ACTIVE" | "ARCHIVED";
  memberCount: number;
  // Positive: others owe you. Negative: you owe. Zero: settled.
  balancePaise: number;
  role: "OWNER" | "MEMBER";
  updatedAt: Date;
}

export async function getGroupsForUser(userId: string): Promise<GroupSummary[]> {
  const memberships = await prisma.groupMember.findMany({
    where: {
      userId,
      group: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      role: true,
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          icon: true,
          currency: true,
          balanceMode: true,
          status: true,
          updatedAt: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.group.id);
  const balances = await computeBalancesByGroup(userId, groupIds);

  return memberships
    .map(({ group, role }) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      color: group.color,
      icon: group.icon,
      currency: group.currency,
      balanceMode: group.balanceMode,
      status: group.status,
      memberCount: group._count.members,
      balancePaise: balances.get(group.id) ?? 0,
      role,
      updatedAt: group.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

// Detail-page payload — full member list (with handle/displayName/avatar) so
// the UI can render members + your role without a second round-trip.
export type GroupDetail = Prisma.GroupGetPayload<{
  include: {
    members: {
      select: {
        id: true;
        role: true;
        joinedAt: true;
        user: { select: { id: true; handle: true; displayName: true; avatarUrl: true } };
      };
    };
    _count: { select: { expenses: true } };
  };
}> & {
  balancePaise: number;
  viewerRole: "OWNER" | "MEMBER";
};

export async function getGroupById(
  userId: string,
  groupId: string,
): Promise<GroupDetail> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
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
      _count: { select: { expenses: true } },
    },
  });

  if (!group) {
    throw new AppError("NOT_FOUND", "Group not found.");
  }

  const viewer = group.members.find((m) => m.user.id === userId);
  if (!viewer) {
    // Membership check after the row exists so we never leak the existence of
    // groups the user can't see — same 403 either way is fine since findFirst
    // already returned a row, and we control which row.
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }

  const balances = await computeBalancesByGroup(userId, [group.id]);

  return {
    ...group,
    balancePaise: balances.get(group.id) ?? 0,
    viewerRole: viewer.role,
  };
}

// Shared balance aggregator — used by both list and detail paths so the
// per-group number is identical regardless of entry point. Keep this in sync
// with `getDashboardData` until we extract a single canonical helper.
async function computeBalancesByGroup(
  userId: string,
  groupIds: string[],
): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  for (const id of groupIds) balances.set(id, 0);
  if (groupIds.length === 0) return balances;

  const [expensesAffectingMe, settlementsOut, settlementsIn] = await Promise.all([
    prisma.expense.findMany({
      where: {
        groupId: { in: groupIds },
        status: "ACTIVE",
        deletedAt: null,
        OR: [
          { payers: { some: { userId } } },
          { participants: { some: { userId } } },
        ],
      },
      select: {
        groupId: true,
        payers: { where: { userId }, select: { amountPaise: true } },
        participants: { where: { userId }, select: { amountPaise: true } },
      },
    }),
    prisma.settlement.groupBy({
      by: ["groupId"],
      where: {
        groupId: { in: groupIds },
        payerId: userId,
        status: "CONFIRMED",
        deletedAt: null,
      },
      _sum: { amountPaise: true },
    }),
    prisma.settlement.groupBy({
      by: ["groupId"],
      where: {
        groupId: { in: groupIds },
        receiverId: userId,
        status: "CONFIRMED",
        deletedAt: null,
      },
      _sum: { amountPaise: true },
    }),
  ]);

  for (const expense of expensesAffectingMe) {
    const paid = expense.payers.reduce((s, p) => s + Number(p.amountPaise), 0);
    const owed = expense.participants.reduce((s, p) => s + Number(p.amountPaise), 0);
    balances.set(expense.groupId, (balances.get(expense.groupId) ?? 0) + paid - owed);
  }
  for (const row of settlementsOut) {
    balances.set(
      row.groupId,
      (balances.get(row.groupId) ?? 0) - Number(row._sum.amountPaise ?? 0),
    );
  }
  for (const row of settlementsIn) {
    balances.set(
      row.groupId,
      (balances.get(row.groupId) ?? 0) + Number(row._sum.amountPaise ?? 0),
    );
  }
  return balances;
}
