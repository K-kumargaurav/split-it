import type { Prisma } from "@/generated/prisma";

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
  if (input.amountPaise > debt.amountPaise) {
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
    select: { id: true, groupId: true, displayName: true },
  });
  if (!ghost) {
    throw new AppError("NOT_FOUND", "Guest link is invalid.");
  }

  const settlement = await prisma.$transaction(async (tx) => {
    // ghostPayerId carries the ghost identity; payerId is set to the
    // receiver as a placeholder UUID-shaped column-fill since the schema
    // requires both `payerId` and `ghostPayerId`. We disambiguate via
    // the presence of `ghostPayerId` in downstream readers.
    //
    // NOTE: the schema's `payerId` is `@relation User`, NOT NULL. Using the
    // receiver as a stand-in keeps referential integrity intact while still
    // making the row unambiguously a ghost-paid settlement (because
    // `ghostPayerId` is set and `payerId === receiverId` is a self-pair
    // that direct-balance code already filters out).
    const created = await tx.settlement.create({
      data: {
        groupId: ghost.groupId,
        payerId: input.receiverId,
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
        actorId: input.receiverId,
        entityType: "SETTLEMENT",
        entityId: created.id,
        action: "CREATED",
        newValue: {
          via: "guest-settle",
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
