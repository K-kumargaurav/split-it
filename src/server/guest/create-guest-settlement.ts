import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { formatPaise } from "@/lib/format";
import {
  guestSettlementSchema,
  type GuestSettlementInput,
} from "@/lib/validations/ghost-members";
import { dispatchExternal } from "@/server/notifications/create-notification";
import { getGuestView } from "@/server/guest/get-guest-view";

// SPEC §4.6 — guest-side "Mark as Settled". The ghost presents their token,
// names a real-member receiver, and asserts a paise amount. We re-derive
// outstanding debt per `getGuestView` so the cap can't be bypassed by a
// stale client. Settlement is created PENDING_CONFIRMATION; the receiver
// gets a notification and must confirm before balances change.

export type CreatedGuestSettlement = Prisma.SettlementGetPayload<{
  include: {
    receiver: { select: { id: true; handle: true; displayName: true } };
  };
}> & { ghostPayerName: string };

export async function createGuestSettlement(
  token: string,
  rawInput: unknown,
): Promise<CreatedGuestSettlement> {
  const parsed = guestSettlementSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Some fields are invalid.",
      parsed.error.issues.map((i) => ({
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    );
  }
  const input: GuestSettlementInput = parsed.data;

  // Re-resolve through the public guest view so all the gating (token valid,
  // group active, debts) is consolidated in one place. Returns 404 on bad
  // token / archived group.
  const view = await getGuestView(token);

  const debt = view.debts.find((d) => d.receiverId === input.receiverId);
  if (!debt) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No outstanding debt to this member.",
      [{ path: ["receiverId"], message: "You don't owe this member anything." }],
    );
  }
  if (BigInt(input.amountPaise) > BigInt(debt.amountPaise)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Amount exceeds your outstanding debt to this member.",
      [
        {
          path: ["amountPaise"],
          message: `You only owe ${formatPaise(debt.amountPaise)} to ${debt.receiverDisplayName}.`,
        },
      ],
    );
  }

  // We need the groupId from the ghost row — the view exposes `group.id`,
  // but loading the ghost again is cheap and lets us pass `ghostPayerId`
  // straight into the settlement.
  const ghost = await prisma.ghostMember.findUnique({
    where: { guestToken: token },
    select: {
      id: true,
      groupId: true,
      displayName: true,
      linkedUserId: true,
      group: { select: { ownerId: true } },
    },
  });
  if (!ghost) {
    throw new AppError("NOT_FOUND", "Guest link is invalid.");
  }

  // Ghost-paid: payerId is null (User-side balances ignore this row), the
  // ghost identity lives on ghostPayerId. Audit log can't carry a null actor
  // — actorId is `@relation User NOT NULL` — so we attribute the action to
  // the user the ghost was eventually linked to (post-merge), and fall back
  // to the group owner when the ghost is still unlinked. That keeps the log
  // referentially intact and points "who did this" at a real human in either
  // case.
  const auditActorId = ghost.linkedUserId ?? ghost.group.ownerId;

  const settlement = await prisma.$transaction(async (tx) => {
    const created = await tx.settlement.create({
      data: {
        groupId: ghost.groupId,
        payerId: null,
        ghostPayerId: ghost.id,
        receiverId: input.receiverId,
        amountPaise: BigInt(input.amountPaise),
        paymentMethod: input.paymentMethod,
        paymentRef: input.paymentRef ?? null,
        status: "PENDING_CONFIRMATION",
      },
      include: {
        receiver: { select: { id: true, handle: true, displayName: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        groupId: ghost.groupId,
        actorId: auditActorId,
        entityType: "SETTLEMENT",
        entityId: created.id,
        action: "CREATED",
        newValue: {
          via: "guest",
          ghostName: ghost.displayName,
          ghostPayerId: ghost.id,
          ghostPayerName: ghost.displayName,
          receiverId: input.receiverId,
          amountPaise: input.amountPaise,
          paymentMethod: input.paymentMethod,
          paymentRef: input.paymentRef ?? null,
          status: "PENDING_CONFIRMATION",
        },
      },
    });

    await tx.notification.create({
      data: {
        userId: input.receiverId,
        type: "SETTLEMENT_PENDING_CONFIRMATION",
        title: "Confirm guest payment",
        body: `Guest ${ghost.displayName} says they paid you ${formatPaise(
          input.amountPaise,
        )} — confirm?`,
        entityType: "SETTLEMENT",
        entityId: created.id,
      },
    });

    return created;
  });

  void dispatchExternal([input.receiverId], {
    type: "SETTLEMENT_PENDING_CONFIRMATION",
    title: "Confirm guest payment",
    body: `Guest ${ghost.displayName} says they paid you ${formatPaise(
      input.amountPaise,
    )} — confirm?`,
    entityType: "SETTLEMENT",
    entityId: settlement.id,
  });

  return { ...settlement, ghostPayerName: ghost.displayName };
}
