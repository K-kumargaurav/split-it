import type { Prisma, PrismaClient } from "@/generated/prisma";

import { equalSplit } from "@/lib/split";
import { AppError } from "@/lib/errors";
import type { ExpensePatch } from "@/lib/validations/proposals";

// Centralised "apply this patch to an expense" used by:
//   • self-edit (own expense, no proposal)
//   • proposal pass (others' expense, after majority vote)
//
// All callers run within a Prisma transaction so the audit log + notifications
// commit atomically with the mutation. We accept the transactional client
// rather than the singleton.

type Tx = Prisma.TransactionClient | PrismaClient;

interface ApplyResult {
  oldSnapshot: Record<string, unknown>;
  newSnapshot: Record<string, unknown>;
  diff: Record<string, { old: unknown; new: unknown }>;
}

export async function applyExpensePatch(
  tx: Tx,
  expenseId: string,
  patch: ExpensePatch,
): Promise<ApplyResult> {
  const before = await tx.expense.findUnique({
    where: { id: expenseId },
    include: {
      participants: { select: { userId: true, amountPaise: true } },
    },
  });
  if (!before) {
    throw new AppError("NOT_FOUND", "Expense not found.");
  }

  const updates: Prisma.ExpenseUpdateInput = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.date !== undefined) updates.date = patch.date;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  // totalAmount changes are only supported for EQUAL splits in v1: we
  // re-run equalSplit() on the existing participants. EXACT / PERCENTAGE
  // edits require the user to re-create the expense.
  if (patch.totalAmount !== undefined) {
    if (before.splitType !== "EQUAL") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Total amount edits are only supported for EQUAL splits in v1.",
        [{ path: ["totalAmount"], message: "Recreate the expense to change EXACT/PERCENTAGE totals." }],
      );
    }
    const shares = equalSplit(patch.totalAmount, before.participants.length);
    updates.baseAmount = BigInt(patch.totalAmount);
    updates.totalAmount = BigInt(patch.totalAmount);
    // Replace participant shares in lockstep with the new total.
    updates.participants = {
      update: before.participants.map((p, i) => ({
        where: { expenseId_userId: { expenseId, userId: p.userId } },
        data: { amountPaise: BigInt(shares[i]!) },
      })),
    };
    // Single-payer payer rows are auto-resolved; multi-payer expenses are
    // out of scope for v1 dispute edits.
    const payerRows = await tx.expensePayer.findMany({ where: { expenseId } });
    if (payerRows.length === 1) {
      updates.payers = {
        update: {
          where: { expenseId_userId: { expenseId, userId: payerRows[0]!.userId } },
          data: { amountPaise: BigInt(patch.totalAmount) },
        },
      };
    } else {
      throw new AppError(
        "VALIDATION_ERROR",
        "Total amount edits require a single payer.",
        [{ path: ["totalAmount"], message: "Multi-payer total edits are not supported in v1." }],
      );
    }
  }

  await tx.expense.update({ where: { id: expenseId }, data: updates });

  const oldSnapshot: Record<string, unknown> = {
    title: before.title,
    totalAmount: Number(before.totalAmount),
    date: before.date,
    notes: before.notes,
  };
  const newSnapshot: Record<string, unknown> = { ...oldSnapshot };
  const diff: Record<string, { old: unknown; new: unknown }> = {};

  if (patch.title !== undefined && patch.title !== before.title) {
    newSnapshot.title = patch.title;
    diff.title = { old: before.title, new: patch.title };
  }
  if (patch.totalAmount !== undefined && patch.totalAmount !== Number(before.totalAmount)) {
    newSnapshot.totalAmount = patch.totalAmount;
    diff.totalAmount = { old: Number(before.totalAmount), new: patch.totalAmount };
  }
  if (
    patch.date !== undefined &&
    patch.date.getTime() !== new Date(before.date).getTime()
  ) {
    newSnapshot.date = patch.date;
    diff.date = { old: before.date, new: patch.date };
  }
  if (patch.notes !== undefined && patch.notes !== before.notes) {
    newSnapshot.notes = patch.notes;
    diff.notes = { old: before.notes, new: patch.notes };
  }

  return { oldSnapshot, newSnapshot, diff };
}
