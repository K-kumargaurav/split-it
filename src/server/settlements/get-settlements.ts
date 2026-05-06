import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { serializePaise } from "@/lib/api-response";

// Paginated read of a group's settlements for the current user. Mirrors the
// expense list pattern: cursor on settlement.id, ordering by createdAt DESC
// with id-tiebreak so the cursor remains stable across same-millisecond
// inserts.

export interface SettlementParty {
  userId: string;
  handle: string;
  displayName: string;
}

// Ghost-paid settlements have no User-side payer (payerId is null on the
// row). The list view still surfaces them so the receiver can confirm/dispute,
// but the payer block reads as a ghost displayName instead of a User handle.
export interface SettlementGhostParty {
  ghostId: string;
  displayName: string;
}

export interface SettlementListItem {
  id: string;
  payer: SettlementParty | SettlementGhostParty;
  receiver: SettlementParty;
  amountPaise: string;
  paymentMethod: "CASH" | "UPI" | "RAZORPAY" | "STRIPE" | "OTHER";
  paymentRef: string | null;
  status: "PENDING_CONFIRMATION" | "CONFIRMED" | "DISPUTED" | "CANCELLED";
  createdAt: Date;
  confirmedAt: Date | null;
}

export interface SettlementPage {
  items: SettlementListItem[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function getSettlementsForGroup(
  userId: string,
  groupId: string,
  cursor?: string,
  limit: number = DEFAULT_LIMIT,
): Promise<SettlementPage> {
  await assertMember(groupId, userId);
  const take = Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);

  const rows = await prisma.settlement.findMany({
    where: { groupId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      payer: { select: { id: true, handle: true, displayName: true } },
      ghostPayer: { select: { id: true, displayName: true } },
      receiver: { select: { id: true, handle: true, displayName: true } },
    },
  });

  const hasMore = rows.length > take;
  const visible = hasMore ? rows.slice(0, take) : rows;

  const items: SettlementListItem[] = visible.map((s) => ({
    id: s.id,
    payer: s.payer
      ? {
          userId: s.payer.id,
          handle: s.payer.handle,
          displayName: s.payer.displayName,
        }
      : {
          ghostId: s.ghostPayer?.id ?? "",
          displayName: s.ghostPayer?.displayName ?? "Guest",
        },
    receiver: {
      userId: s.receiver.id,
      handle: s.receiver.handle,
      displayName: s.receiver.displayName,
    },
    amountPaise: serializePaise(s.amountPaise),
    paymentMethod: s.paymentMethod,
    paymentRef: s.paymentRef,
    status: s.status,
    createdAt: s.createdAt,
    confirmedAt: s.confirmedAt,
  }));

  return {
    items,
    nextCursor: hasMore && visible.length > 0 ? visible[visible.length - 1]!.id : null,
  };
}

async function assertMember(groupId: string, userId: string): Promise<void> {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!m) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }
}
