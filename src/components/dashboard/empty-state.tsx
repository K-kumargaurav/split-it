import Link from "next/link";

// Shown when the user has no active group memberships. Designed to feel like
// an invitation, not a dead end. Mirrors the brand-side proof points so the
// signed-in experience is recognizable as the same product.
export function EmptyState() {
  return (
    <section
      aria-labelledby="empty-heading"
      className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
    >
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
        <div className="p-8 sm:p-10 lg:p-12">
          <p className="font-mono text-xs uppercase tracking-widest text-indigo-600">
            Get started
          </p>
          <h2
            id="empty-heading"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl"
          >
            Create your first group
          </h2>
          <p className="mt-3 max-w-md text-base leading-7 text-slate-600 dark:text-slate-300">
            Groups are how you track shared expenses with friends, flatmates, or trip companions.
            Add an expense, pick who paid, and SplitEasy keeps the math exact to the paise.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/groups/new"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Create a group
            </Link>
            <Link
              href="/groups/join"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Join with an invite link
            </Link>
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
            <Bullet>Exact splits to the paise — no rounding</Bullet>
            <Bullet>Settle up by UPI, cash, or bank</Bullet>
            <Bullet>Guest links so friends pay without signup</Bullet>
            <Bullet>Recurring rent, OTT, and chai-money</Bullet>
          </ul>
        </div>

        <div
          aria-hidden="true"
          className="relative hidden overflow-hidden bg-slate-950 lg:block"
        >
          <div className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="absolute -bottom-16 -right-12 h-64 w-64 rounded-full bg-indigo-700/30 blur-3xl" />
          <div className="relative flex h-full items-center justify-center p-10">
            <div className="w-full max-w-xs space-y-3">
              <ReceiptCard label="Goa Trip" amount="₹12,400" tag="You paid ₹4,800" />
              <ReceiptCard label="Flat 302 — Dec rent" amount="₹45,000" tag="Split 3 ways" />
              <ReceiptCard label="Saturday brunch" amount="₹2,180" tag="You're owed ₹726.67" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 0 1 0 1.42l-7.5 7.5a1 1 0 0 1-1.42 0l-3.5-3.5a1 1 0 0 1 1.42-1.42l2.79 2.79 6.79-6.79a1 1 0 0 1 1.42 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

function ReceiptCard({ label, amount, tag }: { label: string; amount: string; tag: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white dark:bg-slate-900/5 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between text-white">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="font-mono text-sm font-semibold tabular-nums">{amount}</p>
      </div>
      <p className="mt-1 text-xs text-slate-400">{tag}</p>
    </div>
  );
}
