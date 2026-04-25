import { prisma } from "@/lib/prisma";
import type { DashboardData, DashboardGroupSummary } from "@/server/dashboard/types";

// Aggregates a user's view of the home dashboard:
//   • Net balance across all active groups
//   • Per-group balance, member count, last activity
//   • Pending settlement confirmations + open edit-proposal votes
//
// The per-group balance is:
//   (sum of expense_payers I covered)
//   − (sum of expense_participants I owe on)
//   − (sum of confirmed settlements I paid out in this group)
//   + (sum of confirmed settlements I received in this group)
//
// All money is in paise (BigInt in DB → number in JS — safe up to 2^53 paise,
// roughly ₹90 trillion, comfortably above any plausible single-user balance).

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const memberships = await prisma.groupMember.findMany({
    where: {
      userId,
      group: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      group: {
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
          updatedAt: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (memberships.length === 0) {
    return {
      netBalancePaise: 0,
      groups: [],
      pending: { settlementsAwaitingConfirmation: 0, expenseEditVotesPending: 0 },
    };
  }

  const groupIds = memberships.map((m) => m.group.id);

  const [
    expensesAffectingMe,
    settlementsOut,
    settlementsIn,
    lastExpenseDates,
    pendingSettlements,
    pendingProposals,
    votedProposalIds,
  ] = await Promise.all([
    // Pull each expense in my groups that I'm involved in (as payer or
    // participant), including only my rows from each side. Computing
    // net-per-group in JS is fine here — typical user has O(thousands) of
    // expenses across all groups, well within memory.
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
        createdAt: true,
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
    prisma.expense.groupBy({
      by: ["groupId"],
      where: {
        groupId: { in: groupIds },
        deletedAt: null,
      },
      _max: { createdAt: true },
    }),
    prisma.settlement.count({
      where: {
        receiverId: userId,
        status: "PENDING_CONFIRMATION",
        deletedAt: null,
      },
    }),
    prisma.expenseProposal.findMany({
      where: {
        status: "PENDING",
        expiresAt: { gt: new Date() },
        proposedBy: { not: userId },
        expense: {
          groupId: { in: groupIds },
          status: { not: "DELETED" },
        },
      },
      select: { id: true },
    }),
    prisma.proposalVote.findMany({
      where: { voterId: userId },
      select: { proposalId: true },
    }),
  ]);

  const balanceByGroup = new Map<string, number>();
  const lastActivityByGroup = new Map<string, Date>();
  for (const id of groupIds) balanceByGroup.set(id, 0);

  for (const expense of expensesAffectingMe) {
    const paid = expense.payers.reduce((s, p) => s + Number(p.amountPaise), 0);
    const owed = expense.participants.reduce((s, p) => s + Number(p.amountPaise), 0);
    balanceByGroup.set(
      expense.groupId,
      (balanceByGroup.get(expense.groupId) ?? 0) + paid - owed,
    );
  }
  for (const row of settlementsOut) {
    balanceByGroup.set(
      row.groupId,
      (balanceByGroup.get(row.groupId) ?? 0) - Number(row._sum.amountPaise ?? 0),
    );
  }
  for (const row of settlementsIn) {
    balanceByGroup.set(
      row.groupId,
      (balanceByGroup.get(row.groupId) ?? 0) + Number(row._sum.amountPaise ?? 0),
    );
  }
  for (const row of lastExpenseDates) {
    if (row._max.createdAt) lastActivityByGroup.set(row.groupId, row._max.createdAt);
  }

  const groups: DashboardGroupSummary[] = memberships
    .map(({ group }) => ({
      id: group.id,
      name: group.name,
      color: group.color,
      icon: group.icon,
      memberCount: group._count.members,
      balancePaise: balanceByGroup.get(group.id) ?? 0,
      lastActivityAt: lastActivityByGroup.get(group.id) ?? group.updatedAt,
    }))
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

  const netBalancePaise = groups.reduce((s, g) => s + g.balancePaise, 0);

  const votedSet = new Set(votedProposalIds.map((v) => v.proposalId));
  const expenseEditVotesPending = pendingProposals.filter((p) => !votedSet.has(p.id)).length;

  return {
    netBalancePaise,
    groups,
    pending: {
      settlementsAwaitingConfirmation: pendingSettlements,
      expenseEditVotesPending,
    },
  };
}
