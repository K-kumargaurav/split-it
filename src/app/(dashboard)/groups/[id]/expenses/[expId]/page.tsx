import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatPaise, formatRelativeTime } from "@/lib/format";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProposalActions } from "@/components/expenses/proposal-actions";
import { DeleteExpenseButton } from "@/components/expenses/delete-expense-button";
import type { ProposedChanges } from "@/lib/validations/proposals";

interface ExpenseDetailPageProps {
  params: { id: string; expId: string };
}

export default async function ExpenseDetailPage({
  params,
}: ExpenseDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId } },
    select: { id: true },
  });
  if (!member) notFound();

  const expense = await prisma.expense.findUnique({
    where: { id: params.expId },
    include: {
      group: { select: { id: true, name: true } },
      creator: { select: { id: true, displayName: true, handle: true } },
      participants: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      payers: {
        include: { user: { select: { id: true, displayName: true } } },
      },
    },
  });
  if (!expense || expense.groupId !== params.id) notFound();

  // Active = PENDING and within the voting window. Proposals that have
  // expired but haven't been swept by cron yet are treated as inactive
  // for UI purposes.
  const activeProposal = await prisma.expenseProposal.findFirst({
    where: { expenseId: expense.id, status: "PENDING" },
    include: {
      proposer: { select: { id: true, displayName: true } },
      votes: { select: { voterId: true, vote: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const memberCount = await prisma.groupMember.count({
    where: { groupId: params.id },
  });

  const isOwn = expense.createdBy === userId;
  const totalRupeesLabel = formatPaise(Number(expense.totalAmount));

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        handle: session.user.handle,
        image: session.user.image ?? null,
      }}
    >
      <nav className="mb-6 text-sm">
        <Link
          href={`/groups/${params.id}`}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Back to {expense.group.name}
        </Link>
      </nav>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {expense.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {totalRupeesLabel} · paid by {expense.payers.map((p) => p.user.displayName).join(", ")}
            {" · "}added {formatRelativeTime(expense.createdAt)} by {expense.creator.displayName}
            {expense.status === "DELETED" ? " · deleted" : ""}
          </p>
        </div>
        {expense.status !== "DELETED" ? (
          <div className="flex flex-col items-end gap-2">
            <Link
              href={`/groups/${params.id}/expenses/${expense.id}/edit`}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {isOwn ? "Edit" : "Propose edit"}
            </Link>
            <DeleteExpenseButton
              groupId={params.id}
              expenseId={expense.id}
              isOwn={isOwn}
            />
          </div>
        ) : null}
      </header>

      {activeProposal ? (
        <ProposalBanner
          groupId={params.id}
          expenseId={expense.id}
          viewerId={userId}
          memberCount={memberCount}
          proposal={activeProposal}
        />
      ) : null}

      <section className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Split breakdown
        </h2>
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-700">
          {expense.participants.map((p) => (
            <li
              key={p.userId}
              className="flex items-center justify-between py-2 text-sm text-slate-700 dark:text-slate-200"
            >
              <span>
                {p.user.displayName}
                {p.userId === userId ? (
                  <span className="ml-1 text-xs text-slate-400">(you)</span>
                ) : null}
              </span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                {formatPaise(Number(p.amountPaise))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {expense.receiptUrl ? (
        <section className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Receipt
          </h2>
          <a
            href={expense.receiptUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expense.receiptUrl}
              alt="Receipt"
              className="h-40 w-40 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
            />
          </a>
        </section>
      ) : null}
    </DashboardShell>
  );
}

interface ProposalBannerProps {
  groupId: string;
  expenseId: string;
  viewerId: string;
  memberCount: number;
  proposal: {
    id: string;
    proposedBy: string;
    proposer: { id: string; displayName: string };
    expiresAt: Date;
    proposedChanges: unknown;
    votes: { voterId: string; vote: "APPROVE" | "REJECT" }[];
  };
}

function ProposalBanner({
  groupId,
  expenseId,
  viewerId,
  memberCount,
  proposal,
}: ProposalBannerProps) {
  const eligible = Math.max(memberCount - 1, 0);
  const approveCount = proposal.votes.filter((v) => v.vote === "APPROVE").length;
  const rejectCount = proposal.votes.filter((v) => v.vote === "REJECT").length;
  const pending = Math.max(eligible - approveCount - rejectCount, 0);
  const isProposer = proposal.proposedBy === viewerId;
  const hasVoted = proposal.votes.some((v) => v.voterId === viewerId);
  const votingClosed = proposal.expiresAt.getTime() < Date.now();
  const verb = isDeletion(proposal.proposedChanges) ? "deletion" : "edit";

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-900">
            {verb === "deletion" ? "Deletion" : "Edit"} proposed by{" "}
            {proposal.proposer.displayName}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Vote by {formatDateTime(proposal.expiresAt)}
          </p>
          <p className="mt-2 text-xs text-amber-900">
            {approveCount} approved · {rejectCount} rejected · {pending} pending
          </p>
        </div>
        <ProposalActions
          groupId={groupId}
          expenseId={expenseId}
          proposalId={proposal.id}
          isProposer={isProposer}
          hasVoted={hasVoted}
          votingClosed={votingClosed}
        />
      </div>
    </section>
  );
}

function isDeletion(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as ProposedChanges).kind === "DELETE"
  );
}
