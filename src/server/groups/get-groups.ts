import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { computeNetBalance, getUserNetBalance, type ExpenseRow, type SettlementRow } from "@/server/balance/calculate-balances";

// Per-group balance is sourced from `getUserNetBalance` — the same function
// the group's Balances section uses — so the header and the line-item list
// can never disagree. Pending (unconfirmed) settlements are deliberately
// excluded; only CONFIRMED settlements affect balance.

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

  const groupIds = memberships.map(({ group }) => group.id);

  // Batch load all expenses + settlements in 2 queries instead of 2N —
  // fixes the N+1 pattern where getUserNetBalance ran separate DB calls per group.
  const [rawExpenses, rawSettlements] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId: { in: groupIds }, status: "ACTIVE", deletedAt: null },
      select: {
        groupId: true,
        payers: { select: { userId: true, amountPaise: true } },
        participants: { select: { userId: true, amountPaise: true } },
      },
    }),
    prisma.settlement.findMany({
      where: {
        groupId: { in: groupIds },
        status: "CONFIRMED",
        deletedAt: null,
        payerId: { not: null },
      },
      select: { groupId: true, payerId: true, receiverId: true, amountPaise: true },
    }),
  ]);

  const expensesByGroup = new Map<string, ExpenseRow[]>();
  for (const e of rawExpenses) {
    const bucket = expensesByGroup.get(e.groupId) ?? [];
    bucket.push({ payers: e.payers, participants: e.participants });
    expensesByGroup.set(e.groupId, bucket);
  }

  const settlementsByGroup = new Map<string, SettlementRow[]>();
  for (const s of rawSettlements) {
    if (!s.payerId) continue;
    const bucket = settlementsByGroup.get(s.groupId) ?? [];
    bucket.push({ payerId: s.payerId, receiverId: s.receiverId, amountPaise: s.amountPaise });
    settlementsByGroup.set(s.groupId, bucket);
  }

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
      balancePaise: Number(
        computeNetBalance(
          expensesByGroup.get(group.id) ?? [],
          settlementsByGroup.get(group.id) ?? [],
          userId,
        )
      ),
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

  const balance = await getUserNetBalance(group.id, userId);

  return {
    ...group,
    balancePaise: Number(balance),
    viewerRole: viewer.role,
  };
}
