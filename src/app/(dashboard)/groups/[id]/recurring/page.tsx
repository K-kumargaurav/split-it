import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { formatDate, formatPaise } from "@/lib/format";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { GroupTabs } from "@/components/groups/group-tabs";
import { RecurringActions } from "@/components/recurring/recurring-actions";
import { getGroupById, type GroupDetail } from "@/server/groups/get-groups";
import {
  listRecurringTemplates,
  type RecurringTemplateRow,
} from "@/server/recurring/manage-templates";

interface RecurringPageProps {
  params: { id: string };
}

const FREQUENCY_LABEL: Record<RecurringTemplateRow["frequency"], string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every two weeks",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export default async function RecurringPage({ params }: RecurringPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let group: GroupDetail;
  try {
    group = await getGroupById(session.user.id, params.id);
  } catch (err) {
    if (err instanceof AppError && (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")) {
      notFound();
    }
    throw err;
  }

  const templates = await listRecurringTemplates(session.user.id, params.id);

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
        <Link href={`/groups/${group.id}`} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          ← Back to {group.name}
        </Link>
      </nav>

      <GroupTabs groupId={group.id} />

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Recurring expenses
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Templates auto-add an expense on each scheduled date until paused or ended.
          </p>
        </div>
        <Link
          href={`/groups/${group.id}/recurring/new`}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Add recurring
        </Link>
      </header>

      {templates.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No recurring expenses yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Set up rent, subscriptions, or anything that repeats — we&apos;ll add it automatically.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => {
            const partCount = participantCount(t.participantConfig);
            return (
              <li
                key={t.id}
                className={cn(
                  "rounded-2xl border bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6",
                  t.isActive
                    ? "border-slate-200 dark:border-slate-700"
                    : "border-slate-200 dark:border-slate-700 opacity-75",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
                        {t.title}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                          t.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {t.isActive ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {FREQUENCY_LABEL[t.frequency]} · {partCount} participant
                      {partCount === 1 ? "" : "s"} ·{" "}
                      {t.splitType === "EQUAL"
                        ? "Equal"
                        : t.splitType === "EXACT"
                          ? "Exact"
                          : "Percentage"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Next run:{" "}
                      <span className="font-mono text-slate-900 dark:text-white">
                        {formatDate(t.nextRunDate)}
                      </span>
                      {t.endDate ? (
                        <>
                          {" "}
                          · Ends{" "}
                          <span className="font-mono">{formatDate(t.endDate)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatPaise(t.amountPaise)}
                    </p>
                    <RecurringActions
                      groupId={group.id}
                      templateId={t.id}
                      isActive={t.isActive}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}

// participantConfig is JSON in the DB — narrow it just enough to count
// the participants without hard-coding the full schema in the page.
function participantCount(config: RecurringTemplateRow["participantConfig"]): number {
  if (!config || typeof config !== "object" || Array.isArray(config)) return 0;
  const c = config as { participantIds?: unknown; splits?: unknown };
  if (Array.isArray(c.participantIds)) return c.participantIds.length;
  if (Array.isArray(c.splits)) return c.splits.length;
  return 0;
}
