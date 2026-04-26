import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  calculateDirectBalances,
  calculateSimplifiedBalances,
  type BalanceMap,
  type SimplifiedTransfer,
} from "@/server/balance/calculate-balances";
import { getExpensesForGroup, type ExpenseListItem } from "@/server/expenses/get-expenses";
import { getGroupById, type GroupDetail } from "@/server/groups/get-groups";

interface GroupPageProps {
  params: { id: string };
}

export default async function GroupPage({ params }: GroupPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let group: GroupDetail;
  try {
    group = await getGroupById(session.user.id, params.id);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    if (err instanceof AppError && err.code === "FORBIDDEN") notFound();
    throw err;
  }

  const { items: expenses } = await getExpensesForGroup(session.user.id, params.id);

  // Per group's own balance mode (SPEC §3.4 / §4.5). The DB always holds
  // the full direct ledger; we just pick which view to render.
  const balanceLines =
    group.balanceMode === "DIRECT"
      ? toDirectLines(
          await calculateDirectBalances(group.id, session.user.id),
          session.user.id,
          group.members,
        )
      : toSimplifiedLines(
          await calculateSimplifiedBalances(group.id, session.user.id),
          session.user.id,
          group.members,
        );

  const isOwner = group.viewerRole === "OWNER";
  const settled = group.balancePaise === 0;
  const owedToYou = group.balancePaise > 0;

  const balanceTone = settled
    ? { chip: "bg-slate-100 text-slate-600", label: "Settled", amount: "text-slate-500" }
    : owedToYou
      ? { chip: "bg-emerald-50 text-emerald-700", label: "You're owed", amount: "text-emerald-700" }
      : { chip: "bg-rose-50 text-rose-700", label: "You owe", amount: "text-rose-700" };

  const monogramBg = group.color ?? "#6366F1";

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
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">
          ← Back to dashboard
        </Link>
      </nav>

      <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-semibold text-white"
              style={{ backgroundColor: monogramBg }}
            >
              {group.icon ?? group.name[0]?.toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {group.name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {group.members.length} {group.members.length === 1 ? "member" : "members"} ·{" "}
                {group.currency} · {group.balanceMode === "DIRECT" ? "Direct" : "Simplified"}{" "}
                balances
              </p>
              {group.description ? (
                <p className="mt-3 text-sm text-slate-600">{group.description}</p>
              ) : null}
            </div>
          </div>

          {isOwner ? (
            <Link
              href={`/groups/${group.id}/settings`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Settings
            </Link>
          ) : null}
        </div>

        <div className="mt-6 inline-flex flex-col rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <span
            className={cn(
              "inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium",
              balanceTone.chip,
            )}
          >
            {balanceTone.label}
          </span>
          <p className={cn("mt-1.5 font-mono text-2xl font-semibold tabular-nums", balanceTone.amount)}>
            {settled ? "₹0.00" : formatPaise(Math.abs(group.balancePaise))}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <ExpensesSection groupId={group.id} expenses={expenses} viewerId={session.user.id} />
        <div className="space-y-6">
          <BalancesSection lines={balanceLines} mode={group.balanceMode} />
          <MembersSection members={group.members} viewerId={session.user.id} />
        </div>
      </div>
    </DashboardShell>
  );
}

function ExpensesSection({
  groupId,
  expenses,
  viewerId,
}: {
  groupId: string;
  expenses: ExpenseListItem[];
  viewerId: string;
}) {
  const hasExpenses = expenses.length > 0;
  return (
    <section
      aria-labelledby="expenses-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="expenses-heading" className="text-lg font-semibold tracking-tight text-slate-900">
          Expenses
        </h2>
        <Link
          href={`/groups/${groupId}/expenses/new`}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Add expense
        </Link>
      </div>

      {hasExpenses ? (
        <ul className="divide-y divide-slate-100">
          {expenses.map((e) => (
            <ExpenseRow key={e.id} expense={e} viewerId={viewerId} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">No expenses yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Add your first expense — split it equally, by exact amounts, or by percentage.
          </p>
          <Link
            href={`/groups/${groupId}/expenses/new`}
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Add the first expense
          </Link>
        </div>
      )}
    </section>
  );
}

function ExpenseRow({
  expense,
  viewerId,
}: {
  expense: ExpenseListItem;
  viewerId: string;
}) {
  const payerLabel = formatPayerLabel(expense.payers, viewerId);
  const dateLabel = new Date(expense.date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const yourShare = expense.yourSharePaise;
  const youOwe = yourShare - expense.yourPaidPaise;

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{expense.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {payerLabel} · {dateLabel}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
          {formatPaise(expense.totalAmountPaise)}
        </p>
        {yourShare > 0 ? (
          <p
            className={cn(
              "mt-0.5 text-xs",
              youOwe > 0 ? "text-rose-600" : youOwe < 0 ? "text-emerald-600" : "text-slate-500",
            )}
          >
            {youOwe > 0
              ? `You owe ${formatPaise(youOwe)}`
              : youOwe < 0
                ? `You're owed ${formatPaise(-youOwe)}`
                : `Your share ${formatPaise(yourShare)}`}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function formatPayerLabel(
  payers: ExpenseListItem["payers"],
  viewerId: string,
): string {
  if (payers.length === 0) return "Unknown payer";
  if (payers.length === 1) {
    const only = payers[0]!;
    return `Paid by ${only.userId === viewerId ? "you" : only.displayName}`;
  }
  return `Paid by ${payers.length} people`;
}

function MembersSection({
  members,
  viewerId,
}: {
  members: GroupDetail["members"];
  viewerId: string;
}) {
  return (
    <section
      aria-labelledby="members-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <h2 id="members-heading" className="mb-4 text-lg font-semibold tracking-tight text-slate-900">
        Members
      </h2>
      <ul className="divide-y divide-slate-100">
        {members.map((m) => {
          const initial = (m.user.displayName[0] ?? m.user.handle[0] ?? "?").toUpperCase();
          const isYou = m.user.id === viewerId;
          return (
            <li key={m.id} className="flex items-center gap-3 py-3">
              {m.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.user.avatarUrl}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white"
                >
                  {initial}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {m.user.displayName}
                  {isYou ? <span className="ml-1 text-xs text-slate-400">(you)</span> : null}
                </p>
                <p className="truncate text-xs text-slate-500">@{m.user.handle}</p>
              </div>
              {m.role === "OWNER" ? (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Owner
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface BalanceLine {
  // direction is from the viewer's perspective:
  //   "owed"  → the counterparty owes the viewer
  //   "owes"  → the viewer owes the counterparty
  direction: "owed" | "owes";
  counterpartyName: string;
  amountPaise: bigint;
}

function BalancesSection({
  lines,
  mode,
}: {
  lines: BalanceLine[];
  mode: "DIRECT" | "SIMPLIFIED";
}) {
  const modeLabel = mode === "DIRECT" ? "Direct" : "Simplified";
  return (
    <section
      aria-labelledby="balances-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          id="balances-heading"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          Balances
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {modeLabel}
        </span>
      </div>
      {lines.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          You&apos;re all settled up in this group.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {lines.map((line, i) => (
            <li
              key={`${line.direction}-${line.counterpartyName}-${i}`}
              className="flex items-center justify-between gap-4 py-3"
            >
              <p className="text-sm text-slate-700">
                {line.direction === "owed" ? (
                  <>
                    <span className="font-medium text-slate-900">{line.counterpartyName}</span>{" "}
                    owes you
                  </>
                ) : (
                  <>
                    You owe{" "}
                    <span className="font-medium text-slate-900">{line.counterpartyName}</span>
                  </>
                )}
              </p>
              <p
                className={cn(
                  "font-mono text-sm font-semibold tabular-nums",
                  line.direction === "owed" ? "text-emerald-700" : "text-rose-700",
                )}
              >
                {formatPaise(line.amountPaise)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function toDirectLines(
  direct: BalanceMap,
  viewerId: string,
  members: GroupDetail["members"],
): BalanceLine[] {
  const nameOf = (id: string): string => {
    const m = members.find((x) => x.user.id === id);
    return m?.user.displayName ?? "Unknown";
  };

  const ZERO = BigInt(0);
  const lines: BalanceLine[] = [];
  // Money owed to the viewer.
  for (const [debtorId, amount] of Object.entries(direct[viewerId] ?? {})) {
    if (amount > ZERO) {
      lines.push({ direction: "owed", counterpartyName: nameOf(debtorId), amountPaise: amount });
    }
  }
  // Money the viewer owes.
  for (const [creditorId, debts] of Object.entries(direct)) {
    if (creditorId === viewerId) continue;
    const amount = debts[viewerId];
    if (amount && amount > ZERO) {
      lines.push({ direction: "owes", counterpartyName: nameOf(creditorId), amountPaise: amount });
    }
  }
  return lines.sort((a, b) => (a.amountPaise > b.amountPaise ? -1 : 1));
}

function toSimplifiedLines(
  transfers: SimplifiedTransfer[],
  viewerId: string,
  members: GroupDetail["members"],
): BalanceLine[] {
  const nameOf = (id: string): string => {
    const m = members.find((x) => x.user.id === id);
    return m?.user.displayName ?? "Unknown";
  };

  const lines: BalanceLine[] = [];
  for (const t of transfers) {
    if (t.from === viewerId) {
      lines.push({ direction: "owes", counterpartyName: nameOf(t.to), amountPaise: t.amount });
    } else if (t.to === viewerId) {
      lines.push({ direction: "owed", counterpartyName: nameOf(t.from), amountPaise: t.amount });
    }
  }
  return lines.sort((a, b) => (a.amountPaise > b.amountPaise ? -1 : 1));
}
