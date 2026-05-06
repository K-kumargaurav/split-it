import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { serializePaise } from "@/lib/api-response";

// Paginated read of a group's expenses for the current user. Cursor is the
// id of the last item from the previous page; ordering is `createdAt DESC`
// with id-tiebreak so the cursor remains stable when two expenses share a
// timestamp.
//
// Money fields are serialised as strings via serializePaise so the wire
// format is exact at any magnitude — BigInt → string avoids silent rounding
// for amounts above 2^53 paise.

export interface ExpensePayer {
  userId: string;
  displayName: string;
  amountPaise: string;
}

export interface ExpenseParticipantView {
  userId: string;
  displayName: string;
  amountPaise: string;
}

export interface ExpenseListItem {
  id: string;
  title: string;
  totalAmountPaise: string;
  date: Date;
  createdAt: Date;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE";
  payers: ExpensePayer[];
  participants: ExpenseParticipantView[];
  yourSharePaise: string;
  yourPaidPaise: string;
}

export interface ExpensePage {
  items: ExpenseListItem[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function getExpensesForGroup(
  userId: string,
  groupId: string,
  cursor?: string,
  limit: number = DEFAULT_LIMIT,
): Promise<ExpensePage> {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }

  const take = Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);

  // take + 1 lets us peek one row past the requested page so we can decide
  // whether a `nextCursor` should be returned without a separate count.
  const rows = await prisma.expense.findMany({
    where: { groupId, status: "ACTIVE", deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      payers: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      participants: {
        include: { user: { select: { id: true, displayName: true } } },
      },
    },
  });

  const hasMore = rows.length > take;
  const visible = hasMore ? rows.slice(0, take) : rows;

  const items: ExpenseListItem[] = visible.map((e) => {
    const payers: ExpensePayer[] = e.payers.map((p) => ({
      userId: p.userId,
      displayName: p.user.displayName,
      amountPaise: serializePaise(p.amountPaise),
    }));
    const participants: ExpenseParticipantView[] = e.participants.map((p) => ({
      userId: p.userId,
      displayName: p.user.displayName,
      amountPaise: serializePaise(p.amountPaise),
    }));
    return {
      id: e.id,
      title: e.title,
      totalAmountPaise: serializePaise(e.totalAmount),
      date: e.date,
      createdAt: e.createdAt,
      splitType: e.splitType,
      payers,
      participants,
      yourSharePaise: participants.find((p) => p.userId === userId)?.amountPaise ?? "0",
      yourPaidPaise: payers.find((p) => p.userId === userId)?.amountPaise ?? "0",
    };
  });

  return {
    items,
    nextCursor: hasMore && visible.length > 0 ? visible[visible.length - 1]!.id : null,
  };
}
