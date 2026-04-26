import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { formatPaise } from "@/lib/format";
import { calculateDirectBalances } from "@/server/balance/calculate-balances";
import {
  createSettlementSchema,
  type CreateSettlementInput,
} from "@/lib/validations/settlements";

// Returned shape — payer + receiver joined so the caller can echo display
// names without a follow-up fetch.
export type CreatedSettlement = Prisma.SettlementGetPayload<{
  include: {
    payer: { select: { id: true; handle: true; displayName: true } };
    receiver: { select: { id: true; handle: true; displayName: true } };
  };
}>;

const ZERO = BigInt(0);

export async function createSettlement(
  payerId: string,
  groupId: string,
  rawInput: unknown,
): Promise<CreatedSettlement> {
  const parsed = createSettlementSchema.safeParse(rawInput);
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
  const input = parsed.data;

  if (input.receiverId === payerId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "You can't settle a debt with yourself.",
      [{ path: ["receiverId"], message: "Receiver must be a different member." }],
    );
  }

  await assertBothAreMembers(groupId, payerId, input.receiverId);

  // Verify outstanding direct debt: per SPEC §3.4 the underlying ledger always
  // stores direct pairwise debts, so the truth is the direct view regardless
  // of the group's balanceMode. `calculateDirectBalances` also gates the
  // payer's membership — we still re-check above so the error message
  // distinguishes "you aren't in the group" from "the receiver isn't".
  const direct = await calculateDirectBalances(groupId, payerId);
  // direct[creditor][debtor] = paise debtor owes creditor
  const owed = direct[input.receiverId]?.[payerId] ?? ZERO;
  if (owed <= ZERO) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No outstanding debt to this member.",
      [
        {
          path: ["receiverId"],
          message: "You don't currently owe this member anything.",
        },
      ],
    );
  }

  const amountBig = BigInt(input.amountPaise);
  if (amountBig > owed) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Amount exceeds your outstanding debt to this member.",
      [
        {
          path: ["amountPaise"],
          message: `You owe ${formatPaise(owed)} to this member.`,
        },
      ],
    );
  }

  return runCreateTransaction(payerId, groupId, input, amountBig);
}

async function assertBothAreMembers(
  groupId: string,
  payerId: string,
  receiverId: string,
): Promise<void> {
  const rows = await prisma.groupMember.findMany({
    where: { groupId, userId: { in: [payerId, receiverId] } },
    select: { userId: true },
  });
  const hasPayer = rows.some((r) => r.userId === payerId);
  const hasReceiver = rows.some((r) => r.userId === receiverId);

  if (!hasPayer) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }
  if (!hasReceiver) {
    throw new AppError(
      "VALIDATION_ERROR",
      "The receiver is not a member of this group.",
      [{ path: ["receiverId"], message: "Receiver must be a group member." }],
    );
  }
}

async function runCreateTransaction(
  payerId: string,
  groupId: string,
  input: CreateSettlementInput,
  amountBig: bigint,
): Promise<CreatedSettlement> {
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.create({
      data: {
        groupId,
        payerId,
        receiverId: input.receiverId,
        amountPaise: amountBig,
        paymentMethod: input.paymentMethod,
        paymentRef: input.paymentRef ?? null,
        status: "PENDING_CONFIRMATION",
      },
      include: {
        payer: { select: { id: true, handle: true, displayName: true } },
        receiver: { select: { id: true, handle: true, displayName: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        groupId,
        actorId: payerId,
        entityType: "SETTLEMENT",
        entityId: settlement.id,
        action: "CREATED",
        newValue: {
          payerId,
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
        title: "Confirm payment",
        body: `${settlement.payer.displayName} says they paid you ${formatPaise(
          input.amountPaise,
        )} — confirm?`,
        entityType: "SETTLEMENT",
        entityId: settlement.id,
      },
    });

    return settlement;
  });
}
