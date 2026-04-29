import type { ExpenseProposal } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import type { ProposedChanges } from "@/lib/validations/proposals";

import { notifyMembers, PROPOSAL_VOTING_WINDOW_MS } from "./propose-edit";

// SPEC §4.9 case 3: deletion follows the same flow as edits.
//   • Self-author → soft delete immediately (status=DELETED, deletedAt=now)
//   • Other member → open a DELETE-kind proposal; majority vote required.

export interface DeleteResult {
  applied: boolean;
  expenseId: string;
  proposal?: { id: string; expiresAt: Date };
}

export async function deleteExpense(
  userId: string,
  groupId: string,
  expenseId: string,
): Promise<DeleteResult> {
  await assertViewerIsMember(userId, groupId);

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { id: true, groupId: true, title: true, status: true, createdBy: true },
  });
  if (!expense || expense.groupId !== groupId) {
    throw new AppError("NOT_FOUND", "Expense not found in this group.");
  }
  if (expense.status === "DELETED") {
    throw new AppError("CONFLICT", "Expense is already deleted.");
  }

  if (expense.createdBy === userId) {
    return softDeleteImmediately(userId, groupId, expense.id, expense.title, expense.status);
  }

  return openDeletionProposal(userId, groupId, expense.id, expense.title);
}

async function softDeleteImmediately(
  userId: string,
  groupId: string,
  expenseId: string,
  title: string,
  prevStatus: string,
): Promise<DeleteResult> {
  return prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: expenseId },
      data: { status: "DELETED", deletedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        groupId,
        actorId: userId,
        entityType: "EXPENSE",
        entityId: expenseId,
        action: "DELETED",
        oldValue: { status: prevStatus } as object,
        newValue: { status: "DELETED" } as object,
        diff: { status: { old: prevStatus, new: "DELETED" } } as object,
      },
    });

    await notifyMembers(tx, groupId, [userId], {
      type: "EXPENSE_EDITED",
      title: "Expense deleted",
      body: `${title} was deleted`,
      entityId: expenseId,
    });

    return { applied: true, expenseId };
  });
}

async function openDeletionProposal(
  proposerId: string,
  groupId: string,
  expenseId: string,
  title: string,
): Promise<DeleteResult> {
  const existing = await prisma.expenseProposal.findFirst({
    where: { expenseId, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "CONFLICT",
      "A proposal is already active for this expense.",
    );
  }

  const expiresAt = new Date(Date.now() + PROPOSAL_VOTING_WINDOW_MS);
  const proposedChanges: ProposedChanges = { kind: "DELETE" };

  return prisma.$transaction(async (tx) => {
    const proposal: ExpenseProposal = await tx.expenseProposal.create({
      data: {
        expenseId,
        proposedBy: proposerId,
        proposedChanges: proposedChanges as object,
        status: "PENDING",
        expiresAt,
      },
    });

    await notifyMembers(tx, groupId, [proposerId], {
      type: "EXPENSE_EDIT_PROPOSAL",
      title: "Vote on expense deletion",
      body: `${title} — proposed deletion needs your vote`,
      entityId: proposal.id,
    });

    return {
      applied: false,
      expenseId,
      proposal: { id: proposal.id, expiresAt: proposal.expiresAt },
    };
  });
}

async function assertViewerIsMember(userId: string, groupId: string): Promise<void> {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!m) throw new AppError("FORBIDDEN", "You don't have access to this group.");
}
