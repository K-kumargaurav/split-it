import type { Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  proposedChangesSchema,
  type ProposedChanges,
} from "@/lib/validations/proposals";

import { applyExpensePatch } from "./apply-patch";
import { notifyMembers } from "./propose-edit";
import { dispatchExternal } from "@/server/notifications/create-notification";

// SPEC §4.9: voting majority is "strictly more than 50% of members
// (excluding proposer)". Tied votes on expiry favour the status quo
// (rejection) — handled here for the "as soon as remaining-votes can no
// longer change the outcome" early-decide path, and in the cron sweep
// for the timeout case.
//
// Also handles deletion proposals via the same flow: a DELETE-kind
// proposal soft-deletes the expense when it passes.

export type Vote = "APPROVE" | "REJECT";

export interface VoteResult {
  proposalId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approveCount: number;
  rejectCount: number;
  eligibleVoters: number;
}

export async function voteOnProposal(
  userId: string,
  proposalId: string,
  vote: Vote,
): Promise<VoteResult> {
  if (vote !== "APPROVE" && vote !== "REJECT") {
    throw new AppError("VALIDATION_ERROR", "Vote must be APPROVE or REJECT.");
  }

  const proposal = await prisma.expenseProposal.findUnique({
    where: { id: proposalId },
    include: { expense: { select: { id: true, groupId: true, title: true } } },
  });
  if (!proposal) throw new AppError("NOT_FOUND", "Proposal not found.");

  const groupId = proposal.expense.groupId;

  await assertViewerIsMember(userId, groupId);
  if (proposal.proposedBy === userId) {
    throw new AppError("FORBIDDEN", "Proposers cannot vote on their own proposal.");
  }
  if (proposal.status !== "PENDING") {
    throw new AppError("CONFLICT", `Proposal is already ${proposal.status.toLowerCase()}.`);
  }
  if (proposal.expiresAt.getTime() < Date.now()) {
    throw new AppError("CONFLICT", "Voting window has closed.");
  }

  const existingVote = await prisma.proposalVote.findUnique({
    where: { proposalId_voterId: { proposalId, voterId: userId } },
    select: { id: true },
  });
  if (existingVote) {
    throw new AppError("CONFLICT", "You've already voted on this proposal.");
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.proposalVote.create({
      data: { proposalId, voterId: userId, vote },
    });

    return tallyAndDecide(tx, proposalId);
  });

  // Post-commit: push + WhatsApp dispatch for whatever fan-out the inner
  // tally produced (in-app rows already exist). We re-derive recipients
  // here based on the resolved status — for APPROVED, all members; for
  // REJECTED, the proposer only.
  if (result.status === "APPROVED") {
    const members = await prisma.groupMember.findMany({
      where: { groupId: proposal.expense.groupId },
      select: { userId: true },
    });
    void dispatchExternal(
      members.map((m) => m.userId),
      {
        type: "EXPENSE_EDITED",
        title: "Expense updated",
        body: `${proposal.expense.title} — proposal approved`,
        entityType: "EXPENSE",
        entityId: proposal.expense.id,
      },
    );
  } else if (result.status === "REJECTED") {
    void dispatchExternal([proposal.proposedBy], {
      type: "EXPENSE_EDIT_PROPOSAL",
      title: "Proposal rejected",
      body: `Your proposed edit to ${proposal.expense.title} did not pass`,
      entityType: "EXPENSE",
      entityId: proposalId,
    });
  }

  return result;
}

// Counts votes against the current eligible-voter pool (members - proposer).
// Decides the proposal as soon as the outcome is mathematically locked in:
//   • approvals  > floor(eligible / 2)  → APPROVED
//   • rejections > floor(eligible / 2)  → REJECTED
// Otherwise the proposal stays PENDING; the cron sweep finalises ties on
// expiry.
//
// Exported so the cron handler can re-tally on expiry.
export async function tallyAndDecide(
  tx: Prisma.TransactionClient,
  proposalId: string,
): Promise<VoteResult> {
  const proposal = await tx.expenseProposal.findUnique({
    where: { id: proposalId },
    include: {
      votes: { select: { vote: true } },
      expense: { select: { id: true, groupId: true, title: true } },
    },
  });
  if (!proposal) throw new AppError("NOT_FOUND", "Proposal not found.");

  const memberCount = await tx.groupMember.count({
    where: { groupId: proposal.expense.groupId },
  });
  const eligible = Math.max(memberCount - 1, 0);
  const approveCount = proposal.votes.filter((v) => v.vote === "APPROVE").length;
  const rejectCount = proposal.votes.filter((v) => v.vote === "REJECT").length;
  const threshold = Math.floor(eligible / 2);

  // Status defaults to current; only change on a definitive outcome.
  let nextStatus: "PENDING" | "APPROVED" | "REJECTED" = proposal.status as
    | "PENDING"
    | "APPROVED"
    | "REJECTED";

  if (approveCount > threshold) nextStatus = "APPROVED";
  else if (rejectCount > threshold) nextStatus = "REJECTED";

  if (nextStatus === "APPROVED") {
    await applyApproved(tx, proposalId, proposal.expense.groupId, proposal.expense.title, proposal.expense.id, proposal.proposedChanges, proposal.proposedBy);
  } else if (nextStatus === "REJECTED" && proposal.status === "PENDING") {
    await markRejected(tx, proposalId, proposal.proposedBy, proposal.expense.title);
  }

  return {
    proposalId,
    status: nextStatus,
    approveCount,
    rejectCount,
    eligibleVoters: eligible,
  };
}

// Finalises an expired PENDING proposal: a tied or under-threshold tally
// on expiry resolves to REJECTED (SPEC §4.9 "Tied Vote Resolution" — ties
// favour the status quo).
export async function finaliseExpired(
  tx: Prisma.TransactionClient,
  proposalId: string,
): Promise<"APPROVED" | "REJECTED"> {
  const result = await tallyAndDecide(tx, proposalId);
  if (result.status === "APPROVED") return "APPROVED";
  if (result.status === "REJECTED") return "REJECTED";

  // Still PENDING after tally → no majority within the window. Reject.
  const proposal = await tx.expenseProposal.findUnique({
    where: { id: proposalId },
    include: { expense: { select: { title: true } } },
  });
  if (proposal) {
    await markRejected(tx, proposalId, proposal.proposedBy, proposal.expense.title);
  }
  return "REJECTED";
}

async function applyApproved(
  tx: Prisma.TransactionClient,
  proposalId: string,
  groupId: string,
  title: string,
  expenseId: string,
  rawChanges: unknown,
  proposerId: string,
): Promise<void> {
  const parsed = proposedChangesSchema.safeParse(rawChanges);
  if (!parsed.success) {
    // Stored payload is malformed — should never happen, but if it does
    // surface as an internal error rather than silently mis-applying.
    throw new AppError("INTERNAL_ERROR", "Stored proposal payload is invalid.");
  }
  const changes: ProposedChanges = parsed.data;

  let oldSnapshot: Record<string, unknown> = {};
  let newSnapshot: Record<string, unknown> = {};
  let diff: Record<string, unknown> = {};

  if (changes.kind === "EDIT") {
    const result = await applyExpensePatch(tx, expenseId, changes.patch);
    oldSnapshot = result.oldSnapshot;
    newSnapshot = result.newSnapshot;
    diff = result.diff;
  } else {
    // DELETE proposal pass: soft-delete the expense.
    const before = await tx.expense.findUnique({
      where: { id: expenseId },
      select: { title: true, status: true },
    });
    if (!before) throw new AppError("NOT_FOUND", "Expense not found.");
    await tx.expense.update({
      where: { id: expenseId },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    oldSnapshot = { status: before.status };
    newSnapshot = { status: "DELETED" };
    diff = { status: { old: before.status, new: "DELETED" } };
  }

  await tx.expenseProposal.update({
    where: { id: proposalId },
    data: { status: "APPROVED" },
  });

  await tx.auditLog.create({
    data: {
      groupId,
      actorId: proposerId,
      entityType: "EXPENSE",
      entityId: expenseId,
      action: changes.kind === "DELETE" ? "DELETED" : "APPROVED",
      oldValue: oldSnapshot as object,
      newValue: newSnapshot as object,
      diff: diff as object,
    },
  });

  await notifyMembers(tx, groupId, [], {
    type: "EXPENSE_EDITED",
    title: changes.kind === "DELETE" ? "Expense deleted" : "Expense updated",
    body: `${title} — proposal approved`,
    entityId: expenseId,
  });
}

async function markRejected(
  tx: Prisma.TransactionClient,
  proposalId: string,
  proposerId: string,
  title: string,
): Promise<void> {
  await tx.expenseProposal.update({
    where: { id: proposalId },
    data: { status: "REJECTED" },
  });
  await tx.notification.create({
    data: {
      userId: proposerId,
      type: "EXPENSE_EDIT_PROPOSAL",
      title: "Proposal rejected",
      body: `Your proposed edit to ${title} did not pass`,
      entityType: "EXPENSE",
      entityId: proposalId,
    },
  });
}

async function assertViewerIsMember(userId: string, groupId: string): Promise<void> {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!m) throw new AppError("FORBIDDEN", "You don't have access to this group.");
}
