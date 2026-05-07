import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SearchX, Settings } from "lucide-react";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PremiumCard } from "@/components/ui/premium-card";
import { ExpenseFilters } from "@/components/groups/expense-filters";
import { GroupTabNav } from "@/components/groups/group-tab-nav";
import { FloatingAddButton } from "@/components/groups/floating-add-button";
import { BalancesSection } from "@/components/groups/balances-section";
import { PendingSettlementsSection } from "@/components/groups/pending-settlements-section";
import { ActivityFeed } from "@/components/groups/activity-feed";
import { ExpenseList } from "@/components/expenses/expense-list";
import {
  calculateDirectBalances,
  calculateSimplifiedBalances,
} from "@/server/balance/calculate-balances";
import { searchExpenses } from "@/server/expenses/search-expenses";
import { getSettlementsForGroup } from "@/server/settlements/get-settlements";
import { getGroupById } from "@/server/groups/get-groups";
import {
  toExpenseCardData,
  buildLoadMoreHref,
  parseFilterParams,
  toDirectLines,
  toSimplifiedLines,
} from "./page-helpers";

interface GroupPageProps {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function GroupPage({ params, searchParams }: GroupPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let group;
  try {
    group = await getGroupById(session.user.id, params.id);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    if (err instanceof AppError && err.code === "FORBIDDEN") notFound();
    throw err;
  }

  const { filters, hasActiveFilters } = parseFilterParams(searchParams);
  const cursor = typeof searchParams?.cursor === "string" ? searchParams.cursor : undefined;
  const activeTab = searchParams?.tab === "balances" ? "balances" : "expenses";

  const [{ items: expenses, nextCursor }, { items: settlements }, categories] = await Promise.all([
    searchExpenses(session.user.id, params.id, filters, cursor),
    getSettlementsForGroup(session.user.id, params.id, undefined, 50),
    prisma.category.findMany({
      where: { OR: [{ groupId: params.id }, { groupId: null }] },
      select: { id: true, name: true, emoji: true },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    }),
  ]);

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
    ? { label: "All settled", color: "text-[#8B93A7]" }
    : owedToYou
      ? { label: "You're owed", color: "text-[#00C896]" }
      : { label: "You owe", color: "text-[#FF4757]" };

  const expenseCards = expenses.map((e) => toExpenseCardData(e, session.user.id));
  const loadMoreHref = buildLoadMoreHref(nextCursor, searchParams);

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
        <Link href="/dashboard" className="text-[#8B93A7] transition-colors hover:text-[#F5F7FA]">
          ← Back to dashboard
        </Link>
      </nav>

      {/* Group header */}
      <PremiumCard className="mb-6 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-xl font-semibold text-white"
              style={{ backgroundColor: group.color ?? "#6366F1" }}
            >
              {group.icon ?? group.name[0]?.toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-[#F5F7FA] sm:text-3xl">
                {group.name}
              </h1>
              <p className="mt-1 text-[13px] text-[#8B93A7]">
                {group.members.length}{" "}
                {group.members.length === 1 ? "member" : "members"} · {group.currency} ·{" "}
                {group.balanceMode === "DIRECT" ? "Direct" : "Simplified"} balances
              </p>
            </div>
          </div>
          {isOwner && (
            <Link
              href={`/groups/${group.id}/settings`}
              aria-label="Group settings"
              className="flex-shrink-0 text-[#8B93A7] transition-colors hover:text-[#F5F7FA]"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className="mt-5">
          <p className="text-[13px] text-[#8B93A7]">{balanceTone.label}</p>
          <p className={cn("mt-1 font-mono text-3xl font-bold tabular-nums", balanceTone.color)}>
            {settled ? "₹0.00" : formatPaise(Math.abs(group.balancePaise))}
          </p>
        </div>
      </PremiumCard>

      <GroupTabNav groupId={group.id} activeTab={activeTab} />

      {activeTab === "expenses" ? (
        <div className="space-y-6">
          <ExpenseFilters
            members={group.members.map((m) => ({
              id: m.user.id,
              displayName: m.user.displayName,
            }))}
            categories={categories}
          />
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#F5F7FA]">Expenses</h2>
              <Link
                href={`/groups/${group.id}/expenses/new`}
                className="hidden rounded-xl bg-[#00C896] px-3.5 py-2 text-sm font-semibold text-[#0E1116] transition hover:bg-[#00C896]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] sm:inline-flex"
              >
                Add expense
              </Link>
            </div>
            {hasActiveFilters && (
              <p className="mb-3 text-[13px] text-[#8B93A7]">
                {expenses.length} expense{expenses.length !== 1 ? "s" : ""} found
              </p>
            )}
            {hasActiveFilters && expenses.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#161B22] py-14 text-center">
                <SearchX className="h-10 w-10 text-[#8B93A7]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-[#F5F7FA]">No expenses match your filters</p>
                  <p className="mt-1 text-sm text-[#8B93A7]">Try adjusting or clearing your filters</p>
                </div>
                <Link
                  href={`/groups/${group.id}`}
                  className="mt-1 rounded-xl border border-white/[0.06] bg-[#0E1116] px-4 py-2 text-sm font-medium text-[#8B93A7] transition hover:border-white/10 hover:text-[#F5F7FA]"
                >
                  Clear filters
                </Link>
              </div>
            ) : (
              <ExpenseList
                expenses={expenseCards}
                groupId={group.id}
                loadMoreHref={loadMoreHref}
              />
            )}
          </div>
          <ActivityFeed settlements={confirmedSettlements} viewerId={session.user.id} />
        </div>
      ) : (
        <div className="space-y-6">
          <BalancesSection lines={balanceLines} mode={group.balanceMode} groupId={group.id} />
          <PendingSettlementsSection
            groupId={group.id}
            pending={pendingSettlements}
            viewerId={session.user.id}
          />
        </div>
      )}

      <FloatingAddButton href={`/groups/${group.id}/expenses/new`} />
    </DashboardShell>
  );
}
