import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { formatPaise, formatRelativeTime } from "@/lib/format";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PendingSettlementActions } from "@/components/settlements/pending-settlement-actions";
import {
  calculateDirectBalances,
  calculateSimplifiedBalances,
  type BalanceMap,
  type SimplifiedTransfer,
} from "@/server/balance/calculate-balances";
import { getExpensesForGroup, type ExpenseListItem } from "@/server/expenses/get-expenses";
import {
  getSettlementsForGroup,
  type SettlementListItem,
} from "@/server/settlements/get-settlements";
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

  const [{ items: expenses }, { items: settlements }] = await Promise.all([
    getExpensesForGroup(session.user.id, params.id),
    getSettlementsForGroup(session.user.id, params.id, undefined, 50),
  ]);

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

  const pendingSettlements = settlements.filter((s) => s.status === "PENDING_CONFIRMATION");
  const confirmedSettlements = settlements.filter((s) => s.status === "CONFIRMED");

  const isOwner = group.viewerRole === "OWNER";
  const settled = group.balancePaise === 0;
  const owedToYou = group.balancePaise > 0;

  const balanceTone = settled
    ? { chip: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300", label: "Settled", amount: "text-slate-500 dark:text-slate-400" }
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
        <Link href="/dashboard" className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          ← Back to dashboard
        </Link>
      </nav>

      <header className="mb-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8">
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
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {group.name}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {group.members.length} {group.members.length === 1 ? "member" : "members"} ·{" "}
                {group.currency} · {group.balanceMode === "DIRECT" ? "Direct" : "Simplified"}{" "}
                balances
              </p>
              {group.description ? (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{group.description}</p>
              ) : null}
            </div>
          </div>

          {isOwner ? (
            <Link
              href={`/groups/${group.id}/settings`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Settings
            </Link>
          ) : null}
        </div>

        <div className="mt-6 inline-flex flex-col rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-3">
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
        <div className="space-y-6">
          <ExpensesSection groupId={group.id} expenses={expenses} viewerId={session.user.id} />
          <ActivityFeed
            settlements={confirmedSettlements}
            viewerId={session.user.id}
          />
        </div>
        <div className="space-y-6">
          <BalancesSection
            lines={balanceLines}
            mode={group.balanceMode}
            groupId={group.id}
          />
          <PendingSettlementsSection
            groupId={group.id}
            pending={pendingSettlements}
            viewerId={session.user.id}
          />
          <MembersSection
            members={group.members}
            viewerId={session.user.id}
            groupId={group.id}
          />
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
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="expenses-heading" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
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
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {expenses.map((e) => (
            <ExpenseRow key={e.id} expense={e} viewerId={viewerId} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No expenses yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add your first expense — split it equally, by exact amounts, or by percentage.
          </p>
          <Link
            href={`/groups/${groupId}/expenses/new`}
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
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
        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{expense.title}</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {payerLabel} · {dateLabel}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
          {formatPaise(expense.totalAmountPaise)}
        </p>
        {yourShare > 0 ? (
          <p
            className={cn(
              "mt-0.5 text-xs",
              youOwe > 0 ? "text-rose-600" : youOwe < 0 ? "text-emerald-600" : "text-slate-500 dark:text-slate-400",
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
  groupId,
}: {
  members: GroupDetail["members"];
  viewerId: string;
  groupId: string;
}) {
  const MAX_VISIBLE = 5;
  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, members.length - MAX_VISIBLE);
  return (
    <section
      aria-labelledby="members-heading"
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="members-heading"
          className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          Members
        </h2>
        <Link
          href={`/groups/${groupId}/members`}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Manage
        </Link>
      </div>

      <div className="flex items-center -space-x-2">
        {visible.map((m) => {
          const initial = (m.user.displayName[0] ?? m.user.handle[0] ?? "?").toUpperCase();
          const isYou = m.user.id === viewerId;
          const title = `${m.user.displayName}${isYou ? " (you)" : ""} — @${m.user.handle}`;
          return m.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.id}
              src={m.user.avatarUrl}
              alt={title}
              title={title}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <span
              key={m.id}
              aria-label={title}
              title={title}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white ring-2 ring-white"
            >
              {initial}
            </span>
          );
        })}
        {overflow > 0 ? (
          <span
            aria-label={`${overflow} more members`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 ring-2 ring-white"
          >
            +{overflow}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {members.length} {members.length === 1 ? "member" : "members"}
        {members.find((m) => m.role === "OWNER")
          ? ` · ${members.find((m) => m.role === "OWNER")!.user.displayName} is owner`
          : ""}
      </p>
    </section>
  );
}

interface BalanceLine {
  // direction is from the viewer's perspective:
  //   "owed"  → the counterparty owes the viewer
  //   "owes"  → the viewer owes the counterparty
  direction: "owed" | "owes";
  counterpartyName: string;
  counterpartyId: string;
  amountPaise: bigint;
}

function BalancesSection({
  lines,
  mode,
  groupId,
}: {
  lines: BalanceLine[];
  mode: "DIRECT" | "SIMPLIFIED";
  groupId: string;
}) {
  const modeLabel = mode === "DIRECT" ? "Direct" : "Simplified";
  return (
    <section
      aria-labelledby="balances-heading"
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          id="balances-heading"
          className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          Balances
        </h2>
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          {modeLabel}
        </span>
      </div>
      {lines.length === 0 ? (
        <p className="rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          You&apos;re all settled up in this group.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {lines.map((line, i) => (
            <li
              key={`${line.direction}-${line.counterpartyId}-${i}`}
              className="flex items-center justify-between gap-4 py-3"
            >
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {line.direction === "owed" ? (
                  <>
                    <span className="font-medium text-slate-900 dark:text-white">{line.counterpartyName}</span>{" "}
                    owes you
                  </>
                ) : (
                  <>
                    You owe{" "}
                    <span className="font-medium text-slate-900 dark:text-white">{line.counterpartyName}</span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-3">
                <p
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    line.direction === "owed" ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {formatPaise(line.amountPaise)}
                </p>
                {line.direction === "owes" ? (
                  <Link
                    href={`/groups/${groupId}/settlements/new?to=${line.counterpartyId}`}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    Mark as paid
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PendingSettlementsSection({
  groupId,
  pending,
  viewerId,
}: {
  groupId: string;
  pending: SettlementListItem[];
  viewerId: string;
}) {
  if (pending.length === 0) return null;
  return (
    <section
      aria-labelledby="pending-settlements-heading"
      className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm sm:p-8"
    >
      <h2
        id="pending-settlements-heading"
        className="mb-3 text-lg font-semibold tracking-tight text-amber-900"
      >
        Pending settlements
      </h2>
      <ul className="divide-y divide-amber-200/70">
        {pending.map((s) => {
          const isReceiver = s.receiver.userId === viewerId;
          const isPayer = s.payer.userId === viewerId;
          return (
            <li key={s.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  {isPayer ? (
                    <>
                      You paid{" "}
                      <span className="font-medium text-slate-900 dark:text-white">{s.receiver.displayName}</span>
                    </>
                  ) : isReceiver ? (
                    <>
                      <span className="font-medium text-slate-900 dark:text-white">{s.payer.displayName}</span>{" "}
                      paid you
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-slate-900 dark:text-white">{s.payer.displayName}</span> →{" "}
                      <span className="font-medium text-slate-900 dark:text-white">{s.receiver.displayName}</span>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {formatPaise(s.amountPaise)} · {paymentMethodLabel(s.paymentMethod)} ·{" "}
                  {formatRelativeTime(s.createdAt)}
                </p>
              </div>
              {isReceiver ? (
                <PendingSettlementActions groupId={groupId} settlementId={s.id} />
              ) : (
                <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-xs font-medium text-amber-900">
                  Awaiting confirmation
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ActivityFeed({
  settlements,
  viewerId,
}: {
  settlements: SettlementListItem[];
  viewerId: string;
}) {
  if (settlements.length === 0) return null;
  const recent = settlements.slice(0, 8);
  return (
    <section
      aria-labelledby="activity-heading"
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8"
    >
      <h2
        id="activity-heading"
        className="mb-3 text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
      >
        Settlement activity
      </h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {recent.map((s) => {
          const isPayer = s.payer.userId === viewerId;
          const isReceiver = s.receiver.userId === viewerId;
          const when = s.confirmedAt ?? s.createdAt;
          return (
            <li key={s.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                  {isPayer ? (
                    <>
                      You paid{" "}
                      <span className="font-medium text-slate-900 dark:text-white">{s.receiver.displayName}</span>
                    </>
                  ) : isReceiver ? (
                    <>
                      <span className="font-medium text-slate-900 dark:text-white">{s.payer.displayName}</span>{" "}
                      paid you
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-slate-900 dark:text-white">{s.payer.displayName}</span> →{" "}
                      <span className="font-medium text-slate-900 dark:text-white">{s.receiver.displayName}</span>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {paymentMethodLabel(s.paymentMethod)} · {formatRelativeTime(when)}
                </p>
              </div>
              <p className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatPaise(s.amountPaise)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function paymentMethodLabel(method: SettlementListItem["paymentMethod"]): string {
  switch (method) {
    case "CASH":
      return "Cash";
    case "UPI":
      return "UPI";
    case "RAZORPAY":
      return "Razorpay";
    case "STRIPE":
      return "Stripe";
    default:
      return "Other";
  }
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
      lines.push({
        direction: "owed",
        counterpartyName: nameOf(debtorId),
        counterpartyId: debtorId,
        amountPaise: amount,
      });
    }
  }
  // Money the viewer owes.
  for (const [creditorId, debts] of Object.entries(direct)) {
    if (creditorId === viewerId) continue;
    const amount = debts[viewerId];
    if (amount && amount > ZERO) {
      lines.push({
        direction: "owes",
        counterpartyName: nameOf(creditorId),
        counterpartyId: creditorId,
        amountPaise: amount,
      });
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
      lines.push({
        direction: "owes",
        counterpartyName: nameOf(t.to),
        counterpartyId: t.to,
        amountPaise: t.amount,
      });
    } else if (t.to === viewerId) {
      lines.push({
        direction: "owed",
        counterpartyName: nameOf(t.from),
        counterpartyId: t.from,
        amountPaise: t.amount,
      });
    }
  }
  return lines.sort((a, b) => (a.amountPaise > b.amountPaise ? -1 : 1));
}
