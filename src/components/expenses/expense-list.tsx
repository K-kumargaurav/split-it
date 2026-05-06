"use client";

import Link from "next/link";

import { StaggerChildren } from "@/components/ui/motion";
import { ExpenseCard, type ExpenseCardData } from "./expense-card";

interface ExpenseListProps {
  expenses: ExpenseCardData[];
  groupId: string;
  loadMoreHref: string | null;
}

type DateBucket = "Today" | "Yesterday" | "This Week" | "Earlier";

const BUCKETS: DateBucket[] = ["Today", "Yesterday", "This Week", "Earlier"];

function getBucket(date: Date, now: Date): DateBucket {
  const expDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = today.getTime() - expDay.getTime();
  if (diff === 0) return "Today";
  if (diff === 86_400_000) return "Yesterday";
  if (diff < 7 * 86_400_000) return "This Week";
  return "Earlier";
}

export function ExpenseList({ expenses, groupId, loadMoreHref }: ExpenseListProps) {
  const now = new Date();

  const grouped = new Map<DateBucket, ExpenseCardData[]>(BUCKETS.map((b) => [b, []]));
  for (const expense of expenses) {
    const bucket = getBucket(new Date(expense.date), now);
    grouped.get(bucket)!.push(expense);
  }

  const nonEmpty = BUCKETS.filter((b) => (grouped.get(b)?.length ?? 0) > 0);

  if (nonEmpty.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/5 bg-[#161B22] px-5 py-14 text-center">
        <span
          aria-hidden="true"
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-[#8B93A7]">
            <path d="M5 2a1 1 0 0 0-1 1v14.382a.5.5 0 0 0 .724.447L7 16.618l2.276 1.211a.5.5 0 0 0 .448 0L12 16.618l2.276 1.211a.5.5 0 0 0 .724-.447V3a1 1 0 0 0-1-1H5zm2.5 4a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5zm0 3a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5zm0 3a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3z" />
          </svg>
        </span>
        <p className="text-base font-semibold text-[#F5F7FA]">No expenses yet</p>
        <p className="mt-1 text-sm text-[#8B93A7]">Add the first expense to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {nonEmpty.map((bucket) => (
        <div key={bucket}>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[11px] font-medium uppercase tracking-widest text-[#8B93A7]">
              {bucket}
            </span>
            <div className="h-px flex-1 bg-white/5" aria-hidden="true" />
          </div>
          <StaggerChildren className="space-y-2">
            {grouped.get(bucket)!.map((expense) => (
              <ExpenseCard key={expense.id} groupId={groupId} {...expense} />
            ))}
          </StaggerChildren>
        </div>
      ))}

      {loadMoreHref ? (
        <div className="flex justify-center pt-2">
          <Link
            href={loadMoreHref}
            className="rounded-xl border border-white/5 bg-[#161B22] px-4 py-2 text-sm font-medium text-[#8B93A7] transition hover:border-white/10 hover:text-[#F5F7FA]"
          >
            Load more
          </Link>
        </div>
      ) : null}
    </div>
  );
}
