import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

// Filtered + paginated expense feed for SPEC §4.14. Mirrors the shape of
// getExpensesForGroup but accepts an `ExpenseFilters` bag and orders by
// (date DESC, createdAt DESC) so date-bucketed UIs stay correct when two
// expenses landed on the same calendar day at different times.
//
// FTS keyword search uses the GIN index on
//   to_tsvector('english', coalesce(title,'') || ' ' || coalesce(notes,''))
// declared in the Prisma migration. Because Prisma's query builder doesn't
// expose tsvector operators, the keyword branch runs a separate raw SELECT
// for matching ids and folds them into the main `findMany` via `id: in`.

export interface ExpenseFilters {
  dateFrom?: Date;
  dateTo?: Date;
  categoryId?: string;
  paidBy?: string;
  involves?: string;
  minAmount?: bigint;
  maxAmount?: bigint;
  keyword?: string;
}

export interface SearchPayer {
  userId: string;
  displayName: string;
  amountPaise: number;
}

export interface SearchParticipant {
  userId: string;
  displayName: string;
  amountPaise: number;
}

export interface SearchCategory {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

export interface SearchExpenseItem {
  id: string;
  title: string;
  notes: string | null;
  totalAmountPaise: number;
  date: Date;
  createdAt: Date;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE";
  category: SearchCategory | null;
  payers: SearchPayer[];
  participants: SearchParticipant[];
  yourSharePaise: number;
  yourPaidPaise: number;
}

export interface SearchExpensePage {
  items: SearchExpenseItem[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function searchExpenses(
  userId: string,
  groupId: string,
  filters: ExpenseFilters,
  cursor?: string,
  limit: number = DEFAULT_LIMIT,
): Promise<SearchExpensePage> {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }

  const take = Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);

  const where: Prisma.ExpenseWhereInput = {
    groupId,
    status: "ACTIVE",
    deletedAt: null,
  };

  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
    if (filters.dateTo) dateFilter.lte = filters.dateTo;
    where.date = dateFilter;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.paidBy) {
    where.payers = { some: { userId: filters.paidBy } };
  }

  if (filters.involves) {
    where.participants = { some: { userId: filters.involves } };
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    const amountFilter: Prisma.BigIntFilter = {};
    if (filters.minAmount !== undefined) amountFilter.gte = filters.minAmount;
    if (filters.maxAmount !== undefined) amountFilter.lte = filters.maxAmount;
    where.totalAmount = amountFilter;
  }

  // FTS via the GIN index on (title || ' ' || notes). plainto_tsquery
  // tokenises user input safely — no need to sanitise punctuation.
  const trimmedKeyword = filters.keyword?.trim();
  if (trimmedKeyword) {
    const matches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM expenses
      WHERE group_id = ${groupId}
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
        AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(notes, ''))
            @@ plainto_tsquery('english', ${trimmedKeyword})
    `;
    if (matches.length === 0) {
      return { items: [], nextCursor: null };
    }
    where.id = { in: matches.map((m) => m.id) };
  }

  const rows = await prisma.expense.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      payers: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      participants: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      category: { select: { id: true, name: true, emoji: true, color: true } },
    },
  });

  const hasMore = rows.length > take;
  const visible = hasMore ? rows.slice(0, take) : rows;

  const items: SearchExpenseItem[] = visible.map((e) => {
    const payers: SearchPayer[] = e.payers.map((p) => ({
      userId: p.userId,
      displayName: p.user.displayName,
      amountPaise: Number(p.amountPaise),
    }));
    const participants: SearchParticipant[] = e.participants.map((p) => ({
      userId: p.userId,
      displayName: p.user.displayName,
      amountPaise: Number(p.amountPaise),
    }));
    return {
      id: e.id,
      title: e.title,
      notes: e.notes,
      totalAmountPaise: Number(e.totalAmount),
      date: e.date,
      createdAt: e.createdAt,
      splitType: e.splitType,
      category: e.category
        ? {
            id: e.category.id,
            name: e.category.name,
            emoji: e.category.emoji,
            color: e.category.color,
          }
        : null,
      payers,
      participants,
      yourSharePaise: participants.find((p) => p.userId === userId)?.amountPaise ?? 0,
      yourPaidPaise: payers.find((p) => p.userId === userId)?.amountPaise ?? 0,
    };
  });

  return {
    items,
    nextCursor:
      hasMore && visible.length > 0 ? visible[visible.length - 1]!.id : null,
  };
}
