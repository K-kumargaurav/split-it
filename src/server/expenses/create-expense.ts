import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { equalSplit } from "@/lib/split";
import {
  createExpenseSchema,
  type CreateExpenseInput,
} from "@/lib/validations/expenses";

// Returned shape — payers + participants joined with the corresponding user
// row so the API can echo back display names without a follow-up fetch.
export type CreatedExpense = Prisma.ExpenseGetPayload<{
  include: {
    payers: {
      include: {
        user: { select: { id: true; handle: true; displayName: true } };
      };
    };
    participants: {
      include: {
        user: { select: { id: true; handle: true; displayName: true } };
      };
    };
  };
}>;

export async function createExpense(
  userId: string,
  groupId: string,
  rawInput: unknown,
): Promise<CreatedExpense> {
  const parsed = createExpenseSchema.safeParse(rawInput);
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

  await assertViewerIsMember(userId, groupId);
  const memberIds = await loadMemberIds(groupId);
  assertActorsAreMembers(input, memberIds);
  assertPayerSumEqualsTotal(input);

  // EQUAL split: deterministic per SPEC §4.2. Order is significant — the
  // remainder lands on `participantIds[0]`, so the caller's array order is
  // the source of truth for who absorbs the extra paise.
  const shares = equalSplit(input.totalAmount, input.participantIds.length);
  const partSum = shares.reduce((s, x) => s + x, 0);
  if (partSum !== input.totalAmount) {
    // Defence-in-depth — equalSplit() already guarantees this; the check is
    // here so a future refactor can't quietly desync the invariant.
    throw new AppError(
      "VALIDATION_ERROR",
      "Participant splits must sum to the total amount exactly.",
    );
  }

  return runCreateTransaction(userId, groupId, input, shares);
}

async function assertViewerIsMember(userId: string, groupId: string): Promise<void> {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }
}

async function loadMemberIds(groupId: string): Promise<Set<string>> {
  const rows = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

function assertActorsAreMembers(
  input: CreateExpenseInput,
  memberIds: Set<string>,
): void {
  for (const p of input.payerSplits) {
    if (!memberIds.has(p.userId)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "All payers must be members of the group.",
        [{ path: ["payerSplits"], message: `User ${p.userId} is not a member.` }],
      );
    }
  }
  for (const id of input.participantIds) {
    if (!memberIds.has(id)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "All participants must be members of the group.",
        [{ path: ["participantIds"], message: `User ${id} is not a member.` }],
      );
    }
  }
}

function assertPayerSumEqualsTotal(input: CreateExpenseInput): void {
  const payerSum = input.payerSplits.reduce((s, p) => s + p.amountPaise, 0);
  if (payerSum !== input.totalAmount) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Payer amounts must sum to the total amount exactly.",
      [
        {
          path: ["payerSplits"],
          message: `Payers sum to ${payerSum} but total is ${input.totalAmount}.`,
        },
      ],
    );
  }
}

async function runCreateTransaction(
  userId: string,
  groupId: string,
  input: CreateExpenseInput,
  shares: number[],
): Promise<CreatedExpense> {
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        groupId,
        title: input.title,
        categoryId: input.categoryId ?? null,
        baseAmount: BigInt(input.totalAmount),
        totalAmount: BigInt(input.totalAmount),
        splitType: "EQUAL",
        date: input.date,
        createdBy: userId,
        payers: {
          create: input.payerSplits.map((p) => ({
            userId: p.userId,
            amountPaise: BigInt(p.amountPaise),
          })),
        },
        participants: {
          create: input.participantIds.map((uid, i) => ({
            userId: uid,
            amountPaise: BigInt(shares[i]!),
          })),
        },
      },
      include: {
        payers: {
          include: {
            user: { select: { id: true, handle: true, displayName: true } },
          },
        },
        participants: {
          include: {
            user: { select: { id: true, handle: true, displayName: true } },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        groupId,
        actorId: userId,
        entityType: "EXPENSE",
        entityId: expense.id,
        action: "CREATED",
        newValue: {
          title: expense.title,
          totalAmount: input.totalAmount,
          splitType: "EQUAL",
          payerSplits: input.payerSplits,
          participantShares: input.participantIds.map((uid, i) => ({
            userId: uid,
            amountPaise: shares[i]!,
          })),
        },
      },
    });

    return expense;
  });
}
