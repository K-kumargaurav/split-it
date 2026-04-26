import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { formatPaise } from "@/lib/format";

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

  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
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
        newValue: { status: "CONFIRMED", confirmedAt: updated.confirmedAt },
      },
    });

    await tx.notification.create({
      data: {
        userId: existing.payerId,
        type: "SETTLEMENT_CONFIRMED",
        title: "Payment confirmed",
        body: `${updated.receiver.displayName} confirmed your payment of ${formatPaise(
          updated.amountPaise,
        )}.`,
        entityType: "SETTLEMENT",
        entityId: settlementId,
      },
    });

    return updated;
  });
}

export async function disputeSettlement(
  userId: string,
  settlementId: string,
): Promise<SettlementWithUsers> {
  const existing = await loadOrThrow(settlementId);
  assertReceiver(existing, userId);
  assertPending(existing);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: { status: "DISPUTED" },
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

    await tx.notification.create({
      data: {
        userId: existing.payerId,
        type: "SETTLEMENT_DISPUTED",
        title: "Payment disputed",
        body: `${updated.receiver.displayName} disputed your payment of ${formatPaise(
          updated.amountPaise,
        )}. The debt remains on your balance.`,
        entityType: "SETTLEMENT",
        entityId: settlementId,
      },
    });

    return updated;
  });
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
