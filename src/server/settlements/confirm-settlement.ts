import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { formatPaise } from "@/lib/format";
import { dispatchExternal } from "@/server/notifications/create-notification";

// SPEC §4.5 step 4–6: only the receiver can confirm or dispute. Confirming
// flips the status to CONFIRMED and stamps `confirmedAt`; disputing flips it
// to DISPUTED and notifies the payer that the debt is *not* cleared.
//
// Either action is only valid while the settlement is still
// PENDING_CONFIRMATION — once it has moved out of that state the next
// transition is the dispute resolution flow (out of scope for this task).

export type SettlementWithUsers = Prisma.SettlementGetPayload<{
  include: {
    payer: { select: { id: true; handle: true; displayName: true } };
    receiver: { select: { id: true; handle: true; displayName: true } };
  };
}>;

export async function confirmSettlement(
  userId: string,
  settlementId: string,
): Promise<SettlementWithUsers> {
  const existing = await loadOrThrow(settlementId);
  assertReceiver(existing, userId);
  assertPending(existing);

  const updated = await prisma.$transaction(async (tx) => {
    // Re-check status inside the transaction via a conditional update
    // (optimistic lock). Without this, concurrent confirm+dispute requests
    // both pass assertPending on the stale pre-tx snapshot, then race to
    // write conflicting statuses — the final state becomes a coin flip.
    // The updateMany only fires if status is still PENDING_CONFIRMATION;
    // count=0 means a concurrent writer already advanced the state.
    const confirmedAt = new Date();
    const claim = await tx.settlement.updateMany({
      where: { id: settlementId, status: "PENDING_CONFIRMATION" },
      data: { status: "CONFIRMED", confirmedAt },
    });
    if (claim.count === 0) {
      throw new AppError(
        "CONFLICT",
        "This settlement is no longer awaiting confirmation.",
      );
    }

    const row = await tx.settlement.findUniqueOrThrow({
      where: { id: settlementId },
      include: {
        payer: { select: { id: true, handle: true, displayName: true } },
        receiver: { select: { id: true, handle: true, displayName: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        groupId: existing.groupId,
        actorId: userId,
        entityType: "SETTLEMENT",
        entityId: settlementId,
        action: "CONFIRMED",
        oldValue: { status: existing.status },
        newValue: { status: "CONFIRMED", confirmedAt },
      },
    });

    // Ghost-paid settlements have a null payerId (no user account to notify).
    // The ghost was the one who claimed the payment so there's no inbox to
    // ping; the receiver's confirmation only changes balance state.
    if (existing.payerId) {
      await tx.notification.create({
        data: {
          userId: existing.payerId,
          type: "SETTLEMENT_CONFIRMED",
          title: "Payment confirmed",
          body: `${row.receiver.displayName} confirmed your payment of ${formatPaise(
            row.amountPaise,
          )}.`,
          entityType: "SETTLEMENT",
          entityId: settlementId,
        },
      });
    }

    return row;
  });

  if (existing.payerId) {
    void dispatchExternal([existing.payerId], {
      type: "SETTLEMENT_CONFIRMED",
      title: "Payment confirmed",
      body: `${updated.receiver.displayName} confirmed your payment of ${formatPaise(
        updated.amountPaise,
      )}.`,
      entityType: "SETTLEMENT",
      entityId: settlementId,
    });
  }

  return updated;
}

export async function disputeSettlement(
  userId: string,
  settlementId: string,
): Promise<SettlementWithUsers> {
  const existing = await loadOrThrow(settlementId);
  assertReceiver(existing, userId);
  assertPending(existing);

  const updated = await prisma.$transaction(async (tx) => {
    // Same optimistic-lock pattern as confirmSettlement — conditional update
    // prevents a concurrent confirm+dispute pair from both advancing past the
    // PENDING_CONFIRMATION guard on the stale pre-tx snapshot.
    const claim = await tx.settlement.updateMany({
      where: { id: settlementId, status: "PENDING_CONFIRMATION" },
      data: { status: "DISPUTED" },
    });
    if (claim.count === 0) {
      throw new AppError(
        "CONFLICT",
        "This settlement is no longer awaiting confirmation.",
      );
    }

    const row = await tx.settlement.findUniqueOrThrow({
      where: { id: settlementId },
      include: {
        payer: { select: { id: true, handle: true, displayName: true } },
        receiver: { select: { id: true, handle: true, displayName: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        groupId: existing.groupId,
        actorId: userId,
        entityType: "SETTLEMENT",
        entityId: settlementId,
        action: "DISPUTED",
        oldValue: { status: existing.status },
        newValue: { status: "DISPUTED" },
      },
    });

    if (existing.payerId) {
      await tx.notification.create({
        data: {
          userId: existing.payerId,
          type: "SETTLEMENT_DISPUTED",
          title: "Payment disputed",
          body: `${row.receiver.displayName} disputed your payment of ${formatPaise(
            row.amountPaise,
          )}. The debt remains on your balance.`,
          entityType: "SETTLEMENT",
          entityId: settlementId,
        },
      });
    }

    return row;
  });

  if (existing.payerId) {
    void dispatchExternal([existing.payerId], {
      type: "SETTLEMENT_DISPUTED",
      title: "Payment disputed",
      body: `${updated.receiver.displayName} disputed your payment of ${formatPaise(
        updated.amountPaise,
      )}. The debt remains on your balance.`,
      entityType: "SETTLEMENT",
      entityId: settlementId,
    });
  }

  return updated;
}

async function loadOrThrow(settlementId: string): Promise<SettlementWithUsers> {
  const s = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: {
      payer: { select: { id: true, handle: true, displayName: true } },
      receiver: { select: { id: true, handle: true, displayName: true } },
    },
  });
  if (!s || s.deletedAt) {
    throw new AppError("NOT_FOUND", "Settlement not found.");
  }
  return s;
}

function assertReceiver(s: SettlementWithUsers, userId: string): void {
  if (s.receiverId !== userId) {
    throw new AppError(
      "FORBIDDEN",
      "Only the receiver of a settlement can confirm or dispute it.",
    );
  }
}

function assertPending(s: SettlementWithUsers): void {
  if (s.status !== "PENDING_CONFIRMATION") {
    throw new AppError(
      "CONFLICT",
      "This settlement is no longer awaiting confirmation.",
    );
  }
}