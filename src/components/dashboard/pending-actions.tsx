import Link from "next/link";

import type { DashboardPending } from "@/server/dashboard/types";

interface PendingActionsProps {
  pending: DashboardPending;
}

// SPEC §4.12 banner. Renders nothing when nothing's pending.
export function PendingActions({ pending }: PendingActionsProps) {
  const items = buildItems(pending);
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="pending-heading"
      className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="pending-heading"
            className="text-sm font-semibold text-amber-900"
          >
            {items.length === 1 ? "1 thing needs your attention" : `${items.length} things need your attention`}
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-900/90">
            {items.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-3">
                <span>{item.label}</span>
                <Link
                  href={item.href}
                  className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100"
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function buildItems(p: DashboardPending) {
  const items: { label: string; href: string }[] = [];
  if (p.settlementsAwaitingConfirmation > 0) {
    items.push({
      label: `${p.settlementsAwaitingConfirmation} ${
        p.settlementsAwaitingConfirmation === 1 ? "settlement" : "settlements"
      } awaiting your confirmation`,
      href: "/settlements/pending",
    });
  }
  if (p.expenseEditVotesPending > 0) {
    items.push({
      label: `${p.expenseEditVotesPending} expense edit ${
        p.expenseEditVotesPending === 1 ? "proposal" : "proposals"
      } need your vote`,
      href: "/proposals/pending",
    });
  }
  return items;
}
