import { prisma } from "@/lib/prisma";
import type { ExpenseRow, SettlementRow } from "@/server/balance/calculate-balances";

/**
 * Batch-loads all expenses and settlements for a set of groups in exactly
 * 2 DB queries (instead of 2 per group). Returns Maps keyed by groupId so
 * callers can feed each slice into the pure `computeNetBalance()`.
 */
export async function batchLoadLedger(groupIds: string[]): Promise<{
  expensesByGroup: Map<string, ExpenseRow[]>;
  settlementsByGroup: Map<string, SettlementRow[]>;
}> {
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

  return { expensesByGroup, settlementsByGroup };
}
