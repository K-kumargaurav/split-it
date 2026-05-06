import { prisma } from "@/lib/prisma";
import { getUserNetBalance } from "@/server/balance/calculate-balances";
import { serializePaise } from "@/lib/api-response";
import type { DashboardData, DashboardGroupSummary } from "@/server/dashboard/types";

// Aggregates a user's view of the home dashboard:
//   • Net balance across all active groups
//   • Per-group balance, member count, last activity
//   • Pending settlement confirmations + open edit-proposal votes
//
// Per-group balance is sourced from `getUserNetBalance` — the same algorithm
// the group-detail page's Balances section uses — so the dashboard cards and
// the group page can never disagree on a number. Pending (unconfirmed)
// settlements are deliberately excluded from balance; they're surfaced in
// the dedicated "awaiting confirmation" section instead.
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
          // First 4 members for the card avatar stack — joinedAt asc keeps the
          // ordering stable across renders, so the same four faces always show
          // up in the same slots.
          members: {
            take: 4,
            orderBy: { joinedAt: "asc" },
            select: {
              id: true,
              user: { select: { displayName: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  });

  if (memberships.length === 0) {
    return {
      netBalancePaise: "0",
      groups: [],
      pending: { settlementsAwaitingConfirmation: 0, expenseEditVotesPending: 0 },
    };
  }

  const groupIds = memberships.map((m) => m.group.id);

  const [
    perGroupBalances,
    lastExpenseDates,
    lastExpensePerGroup,
    pendingSettlements,
    pendingProposals,
    votedProposalIds,
  ] = await Promise.all([
    // One canonical net per group — same function the group-detail page uses
    // for its Balances section. Pending settlements are excluded by design.
    Promise.all(groupIds.map((id) => getUserNetBalance(id, userId))),
    prisma.expense.groupBy({
      by: ["groupId"],
      where: {
        groupId: { in: groupIds },
        deletedAt: null,
      },
      _max: { createdAt: true },
    }),
    // Most recent active expense per group, for the card preview line. We
    // fan-out one findFirst per group so each query can use a `take: 1` with
    // an index-friendly orderBy — Prisma can't do "top-N per group" natively
    // and this is bounded by the user's group count (small).
    Promise.all(
      groupIds.map((id) =>
        prisma.expense.findFirst({
          where: { groupId: id, status: "ACTIVE", deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { groupId: true, title: true, date: true },
        }),
      ),
    ),
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

  const balanceByGroup = new Map<string, string>();
  const lastActivityByGroup = new Map<string, Date>();
  groupIds.forEach((id, i) => {
    balanceByGroup.set(id, serializePaise(perGroupBalances[i] ?? BigInt(0)));
  });

  for (const row of lastExpenseDates) {
    if (row._max.createdAt) lastActivityByGroup.set(row.groupId, row._max.createdAt);
  }

  const lastExpenseByGroup = new Map<string, { title: string; date: Date }>();
  for (const expense of lastExpensePerGroup) {
    if (expense) {
      lastExpenseByGroup.set(expense.groupId, {
        title: expense.title,
        date: expense.date,
      });
    }
  }

  const groups: DashboardGroupSummary[] = memberships
    .map(({ group }) => ({
      id: group.id,
      name: group.name,
      color: group.color,
      icon: group.icon,
      memberCount: group._count.members,
      balancePaise: balanceByGroup.get(group.id) ?? "0",
      lastActivityAt: lastActivityByGroup.get(group.id) ?? group.updatedAt,
      members: group.members.map((m) => ({
        id: m.id,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
      })),
      lastExpense: lastExpenseByGroup.get(group.id) ?? null,
    }))
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

  const netBalancePaise = serializePaise(
    groups.reduce((s, g) => s + BigInt(g.balancePaise), BigInt(0)),
  );

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
