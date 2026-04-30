import Link from "next/link";

import { cn } from "@/lib/cn";

interface QuickActionsProps {
  hasGroups: boolean;
}

const PRIMARY = cn(
  "group flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-left shadow-sm transition",
  "hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
);

export function QuickActions({ hasGroups }: QuickActionsProps) {
  return (
    <section aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="sr-only">
        Quick actions
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/groups/new" className={PRIMARY}>
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"
          >
            <PlusIcon />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Create a group</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Start splitting expenses with friends</p>
          </div>
          <Arrow />
        </Link>

        <Link
          href={hasGroups ? "/expenses/new" : "/groups/new"}
          aria-disabled={!hasGroups}
          className={cn(PRIMARY, !hasGroups && "cursor-not-allowed opacity-60 hover:-translate-y-0 hover:shadow-sm")}
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
          >
            <ReceiptIcon />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Add an expense</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {hasGroups ? "Pick a group and split" : "Create a group first"}
            </p>
          </div>
          <Arrow />
        </Link>
      </div>
    </section>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 3a.75.75 0 0 1 .75.75v5.5h5.5a.75.75 0 0 1 0 1.5h-5.5v5.5a.75.75 0 0 1-1.5 0v-5.5h-5.5a.75.75 0 0 1 0-1.5h5.5v-5.5A.75.75 0 0 1 10 3z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M5 2a1 1 0 0 0-1 1v14.382a.5.5 0 0 0 .724.447L7 16.618l2.276 1.211a.5.5 0 0 0 .448 0L12 16.618l2.276 1.211a.5.5 0 0 0 .724-.447V3a1 1 0 0 0-1-1H5zm2.5 4a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5zm0 3a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5zm0 3a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3z" />
    </svg>
  );
}

function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600 dark:hover:text-slate-300"
    >
      →
    </span>
  );
}
