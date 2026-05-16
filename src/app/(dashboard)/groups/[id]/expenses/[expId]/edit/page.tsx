import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExpenseEditForm } from "@/components/expenses/expense-edit-form";

interface EditExpensePageProps {
  params: { id: string; expId: string };
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: session.user.id } },
    select: { id: true },
  });
  if (!member) notFound();

  const expense = await prisma.expense.findUnique({
    where: { id: params.expId },
    select: {
      id: true,
      groupId: true,
      title: true,
      totalAmount: true,
      date: true,
      notes: true,
      createdBy: true,
      status: true,
      group: { select: { name: true } },
    },
  });

  if (!expense || expense.groupId !== params.id) notFound();
  if (expense.status === "DELETED") notFound();

  // Check for active proposal — block editing if one is already pending
  const activeProposal = await prisma.expenseProposal.findFirst({
    where: { expenseId: expense.id, status: "PENDING" },
    select: { id: true },
  });

  const isOwn = expense.createdBy === session.user.id;

  return (
    <div className="mx-auto max-w-xl">
      <nav className="mb-6">
        <Link
          href={`/groups/${params.id}/expenses/${expense.id}`}
          className="inline-flex items-center gap-1 text-[13px] text-text-secondary transition hover:text-text-primary"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Back to expense
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-text-primary">
          {isOwn ? "Edit expense" : "Propose edit"}
        </h1>
        <p className="mt-1.5 text-[14px] text-text-secondary">
          {isOwn
            ? `Update "${expense.title}" in ${expense.group.name}.`
            : `Suggest changes to "${expense.title}" — members will vote.`}
        </p>
      </header>

      {activeProposal ? (
        <div className="rounded-3xl border border-warning/20 bg-warning/5 p-6 sm:p-8">
          <p className="text-[14px] font-semibold text-warning">
            An edit proposal is already active
          </p>
          <p className="mt-1.5 text-[13px] text-warning/70">
            Only one proposal can be active at a time. Wait for the current vote
            to finish or expire before proposing new changes.
          </p>
          <Link
            href={`/groups/${params.id}/expenses/${expense.id}`}
            className="mt-4 inline-flex rounded-2xl border border-warning/20 bg-warning/10 px-4 py-2.5 text-sm font-medium text-warning transition hover:bg-warning/15"
          >
            Back to expense
          </Link>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/5 bg-card p-6 shadow-card sm:p-8">
          <ExpenseEditForm
            groupId={params.id}
            expenseId={expense.id}
            isOwn={isOwn}
            current={{
              title: expense.title,
              totalAmountPaise: Number(expense.totalAmount),
              date: expense.date.toISOString(),
              notes: expense.notes,
            }}
          />
        </div>
      )}
    </div>
  );
}
