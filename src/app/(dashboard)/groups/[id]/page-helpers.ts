import { expenseFiltersSchema } from "@/lib/validations/expenses";
import type { BalanceLine } from "@/components/groups/balances-section";
import type { ExpenseCardData } from "@/components/expenses/expense-card";
import type {
  ExpenseFilters as ExpenseFilterValues,
  SearchExpenseItem,
} from "@/server/expenses/search-expenses";
import type {
  BalanceMap,
  SimplifiedTransfer,
} from "@/server/balance/calculate-balances";
import type { GroupDetail } from "@/server/groups/get-groups";

export function toExpenseCardData(e: SearchExpenseItem, viewerId: string): ExpenseCardData {
  const paidByName =
    e.payers.length === 0
      ? "Unknown"
      : e.payers.length === 1
        ? e.payers[0]!.displayName
        : "Multiple";
  return {
    id: e.id,
    title: e.title,
    totalAmountPaise: e.totalAmountPaise,
    date: e.date,
    categoryName: e.category?.name ?? null,
    categoryEmoji: e.category?.emoji ?? null,
    paidByName,
    paidByYou: e.payers.some((p) => p.userId === viewerId),
    yourSharePaise: e.yourSharePaise,
    youPaidPaise: e.yourPaidPaise,
    splitType: e.splitType,
    participantCount: e.participants.length,
  };
}

export function buildLoadMoreHref(
  nextCursor: string | null,
  searchParams: Record<string, string | string[] | undefined> | undefined,
): string | null {
  if (!nextCursor) return null;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (typeof v === "string" && v.trim() && k !== "cursor") p.set(k, v);
  }
  p.set("cursor", nextCursor);
  return `?${p.toString()}`;
}

export function parseFilterParams(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): { filters: ExpenseFilterValues; hasActiveFilters: boolean } {
  if (!searchParams) return { filters: {}, hasActiveFilters: false };
  const KEYS = [
    "dateFrom", "dateTo", "categoryId", "paidBy", "involves",
    "minAmount", "maxAmount", "keyword",
  ] as const;
  const raw: Record<string, string> = {};
  let active = false;
  for (const key of KEYS) {
    const v = searchParams[key];
    if (typeof v === "string" && v.trim().length > 0) { raw[key] = v; active = true; }
  }
  const parsed = expenseFiltersSchema.safeParse(raw);
  if (!parsed.success) return { filters: {}, hasActiveFilters: false };
  return {
    filters: {
      dateFrom: parsed.data.dateFrom, dateTo: parsed.data.dateTo,
      categoryId: parsed.data.categoryId, paidBy: parsed.data.paidBy,
      involves: parsed.data.involves, minAmount: parsed.data.minAmount,
      maxAmount: parsed.data.maxAmount, keyword: parsed.data.keyword,
    },
    hasActiveFilters: active,
  };
}

export function toDirectLines(
  direct: BalanceMap,
  viewerId: string,
  members: GroupDetail["members"],
): BalanceLine[] {
  const nameOf = (id: string) =>
    members.find((x) => x.user.id === id)?.user.displayName ?? "Unknown";
  const ZERO = BigInt(0);
  const lines: BalanceLine[] = [];
  for (const [debtorId, amount] of Object.entries(direct[viewerId] ?? {})) {
    if (amount > ZERO)
      lines.push({ direction: "owed", counterpartyName: nameOf(debtorId), counterpartyId: debtorId, amountPaise: amount });
  }
  for (const [creditorId, debts] of Object.entries(direct)) {
    if (creditorId === viewerId) continue;
    const amount = debts[viewerId];
    if (amount && amount > ZERO)
      lines.push({ direction: "owes", counterpartyName: nameOf(creditorId), counterpartyId: creditorId, amountPaise: amount });
  }
  return lines.sort((a, b) => (a.amountPaise > b.amountPaise ? -1 : 1));
}

export function toSimplifiedLines(
  transfers: SimplifiedTransfer[],
  viewerId: string,
  members: GroupDetail["members"],
): BalanceLine[] {
  const nameOf = (id: string) =>
    members.find((x) => x.user.id === id)?.user.displayName ?? "Unknown";
  const lines: BalanceLine[] = [];
  for (const t of transfers) {
    if (t.from === viewerId)
      lines.push({ direction: "owes", counterpartyName: nameOf(t.to), counterpartyId: t.to, amountPaise: t.amount });
    else if (t.to === viewerId)
      lines.push({ direction: "owed", counterpartyName: nameOf(t.from), counterpartyId: t.from, amountPaise: t.amount });
  }
  return lines.sort((a, b) => (a.amountPaise > b.amountPaise ? -1 : 1));
}
