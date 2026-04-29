import type { ExpenseProposal } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  expensePatchSchema,
  type ExpensePatch,
  type ProposedChanges,
} from "@/lib/validations/proposals";

import { applyExpensePatch } from "./apply-patch";

// SPEC §4.9 case 1+2: edits to your own expense are applied immediately;
// edits to someone else's go through a proposal + 48h voting window. Only
// one active proposal is allowed per expense (SPEC "Concurrent Proposal
// Limit") — we enforce that with a uniqueness check before insert.

export const PROPOSAL_VOTING_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface ProposeEditResult {
  applied: boolean; // true when the change was applied immediately (own expense)
  expenseId: string;
  proposal?: {
    id: string;
    expiresAt: Date;
    proposedChanges: ProposedChanges;
  };
}

export async function proposeExpenseEdit(
  userId: string,
  groupId: string,
  expenseId: string,
  rawChanges: unknown,
): Promise<ProposeEditResult> {
  const parsed = expensePatchSchema.safeParse(rawChanges);
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
  const patch = parsed.data;

  await assertViewerIsMember(userId, groupId);
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { id: true, groupId: true, title: true, createdBy: true, status: true },
  });
  if (!expense || expense.groupId !== groupId) {
    throw new AppError("NOT_FOUND", "Expense not found in this group.");
  }
  if (expense.status === "DELETED") {
    throw new AppError("VALIDATION_ERROR", "Cannot edit a deleted expense.");
  }

  // Self-author shortcut: apply directly + audit + notify the whole group.
  if (expense.createdBy === userId) {
    return applyImmediately(userId, groupId, expenseId, expense.title, patch);
  }

  // Proposal path. Reject if an active proposal already exists for this
  // expense — SPEC §4.9 "Concurrent Proposal Limit".
  return openProposal(userId, groupId, expenseId, expense.title, patch);
}

async function applyImmediately(
  userId: string,
  groupId: string,
  expenseId: string,
  title: string,
  patch: ExpensePatch,
): Promise<ProposeEditResult> {
  return prisma.$transaction(async (tx) => {
    const result = await applyExpensePatch(tx, expenseId, patch);

    await tx.auditLog.create({
      data: {
        groupId,
        actorId: userId,
        entityType: "EXPENSE",
        entityId: expenseId,
        action: "UPDATED",
        oldValue: result.oldSnapshot as object,
        newValue: result.newSnapshot as object,
        diff: result.diff as object,
      },
    });

    await notifyMembers(tx, groupId, [userId], {
      type: "EXPENSE_EDITED",
      title: "Expense updated",
      body: `${title} was edited`,
      entityId: expenseId,
    });

    return { applied: true, expenseId };
  });
}

async function openProposal(
  proposerId: string,
  groupId: string,
  expenseId: string,
  title: string,
  patch: ExpensePatch,
): Promise<ProposeEditResult> {
  const existing = await prisma.expenseProposal.findFirst({
    where: { expenseId, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "CONFLICT",
      "An edit proposal is already active for this expense.",
    );
  }

  const expiresAt = new Date(Date.now() + PROPOSAL_VOTING_WINDOW_MS);
  const proposedChanges: ProposedChanges = { kind: "EDIT", patch };

  return prisma.$transaction(async (tx) => {
    let proposal: ExpenseProposal;
    try {
      proposal = await tx.expenseProposal.create({
        data: {
          expenseId,
          proposedBy: proposerId,
          proposedChanges: proposedChanges as object,
          status: "PENDING",
          expiresAt,
        },
      });
    } catch (err) {
      // Defence in depth — race-condition between the findFirst above and
      // this insert. A unique partial index on (expenseId WHERE PENDING)
      // would be ideal at the DB layer; absent that, surface CONFLICT.
      throw asConflict(err);
    }

    await notifyMembers(tx, groupId, [proposerId], {
      type: "EXPENSE_EDIT_PROPOSAL",
      title: "Vote on expense edit",
      body: `${title} — proposed change needs your vote`,
      entityId: proposal.id,
    });

    return {
      applied: false,
      expenseId,
      proposal: {
        id: proposal.id,
        expiresAt: proposal.expiresAt,
        proposedChanges,
      },
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

interface NotifyOpts {
  type:
    | "EXPENSE_ADDED"
    | "EXPENSE_EDITED"
    | "EXPENSE_EDIT_PROPOSAL"
    | "MEMBERSHIP_CHANGED";
  title: string;
  body: string;
  entityId: string;
}

// Re-exported for the vote/delete modules so notification fan-out is
// consistent. `excludeUserIds` lets callers skip the actor (proposer or
// editor) so they don't notify themselves.
export async function notifyMembers(
  tx: { groupMember: { findMany: typeof prisma.groupMember.findMany }; notification: { createMany: typeof prisma.notification.createMany } },
  groupId: string,
  excludeUserIds: string[],
  opts: NotifyOpts,
): Promise<void> {
  const members = await tx.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const exclude = new Set(excludeUserIds);
  const data = members
    .filter((m) => !exclude.has(m.userId))
    .map((m) => ({
      userId: m.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      entityType: "EXPENSE" as const,
      entityId: opts.entityId,
    }));
  if (data.length > 0) {
    await tx.notification.createMany({ data });
  }
}

function asConflict(err: unknown): AppError {
  return new AppError(
    "CONFLICT",
    "An edit proposal is already active for this expense.",
    err instanceof Error ? [{ path: [], message: err.message }] : undefined,
  );
}
