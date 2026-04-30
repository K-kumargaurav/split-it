import { notFound } from "next/navigation";

import { AppError } from "@/lib/errors";
import { formatPaise } from "@/lib/format";
import { GuestDebtActions } from "@/components/guest/guest-debt-actions";
import { getGuestView, type GuestView } from "@/server/guest/get-guest-view";

interface GuestPageProps {
  params: { token: string };
}

// SPEC §4.6 — public, mobile-first guest view. No header, no nav, no login
// CTA. The page is reachable only with the 32-byte token in the URL; nothing
// else on this page reveals other members' balances.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuestPage({ params }: GuestPageProps) {
  let view: GuestView;
  try {
    view = await getGuestView(params.token);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const settled = view.totalOwedPaise === 0;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-800 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Guest view
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Hi {view.displayName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Here&apos;s your balance in{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">{view.group.name}</span>.
          </p>
        </header>

        <section
          aria-label="Total balance"
          className={
            settled
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center"
              : "rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-center"
          }
        >
          <p
            className={
              settled
                ? "text-xs font-medium uppercase tracking-wider text-emerald-700"
                : "text-xs font-medium uppercase tracking-wider text-rose-700"
            }
          >
            {settled ? "All settled up" : "You owe"}
          </p>
          <p
            className={
              settled
                ? "mt-1 font-mono text-3xl font-semibold tabular-nums text-emerald-700"
                : "mt-1 font-mono text-3xl font-semibold tabular-nums text-rose-700"
            }
          >
            {formatPaise(view.totalOwedPaise)}
          </p>
        </section>

        {view.debts.length > 0 ? (
          <section
            aria-labelledby="debts-heading"
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <h2 id="debts-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
              Pay back
            </h2>
            <ul className="mt-3 space-y-4">
              {view.debts.map((d) => (
                <li
                  key={d.receiverId}
                  className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      You owe{" "}
                      <span className="font-medium text-slate-900 dark:text-white">
                        {d.receiverDisplayName}
                      </span>
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums text-rose-700">
                      {formatPaise(d.amountPaise)}
                    </p>
                  </div>
                  <GuestDebtActions
                    token={params.token}
                    receiverId={d.receiverId}
                    receiverDisplayName={d.receiverDisplayName}
                    receiverHandle={d.receiverHandle}
                    amountPaise={d.amountPaise}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {view.expenseShares.length > 0 ? (
          <section
            aria-labelledby="shares-heading"
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <h2 id="shares-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
              Your share of each expense
            </h2>
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {view.expenseShares.map((s) => (
                <li
                  key={s.expenseId}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      Your share of {s.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(s.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="font-mono text-sm tabular-nums text-slate-900 dark:text-white">
                    {formatPaise(s.yourSharePaise)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="pt-4 text-center text-xs text-slate-400">
          Generated by SplitEasy
        </footer>
      </div>
    </main>
  );
}
