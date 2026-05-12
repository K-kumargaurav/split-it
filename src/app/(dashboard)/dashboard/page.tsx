import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { BalanceHero } from "@/components/dashboard/balance-hero";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { GroupsSection } from "@/components/dashboard/groups-section";
import { PendingActions } from "@/components/dashboard/pending-actions";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { FadeIn } from "@/components/ui/motion";
import { getDashboardData } from "@/server/dashboard/get-dashboard-data";
import type { GroupCardData } from "@/components/dashboard/group-card";

// Fully-RSC dashboard. Middleware (auth-edge) already rejects unauthenticated
// requests; the redirect here is a defence-in-depth fallback for the rare
// case where the session cookie is present but the user record is gone.
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const data = await getDashboardData(session.user.id);
  const displayName = session.user.name ?? `@${session.user.handle}`;

  // Derive owed-to-you / you-owe from per-group balances (positive = owed to
  // you, negative = you owe). These are the absolute sums of each direction.
  const owedToYouPaise = data.groups
    .filter((g) => Number(g.balancePaise) > 0)
    .reduce((sum, g) => sum + BigInt(g.balancePaise), BigInt(0))
    .toString();

  const youOwePaise = data.groups
    .filter((g) => Number(g.balancePaise) < 0)
    .reduce((sum, g) => sum + -BigInt(g.balancePaise), BigInt(0))
    .toString();

  // Map DashboardGroupSummary → GroupCardData for the redesigned cards.
  // settlementProgress is binary: 100 when fully settled, 0 when any balance
  // remains — we don't have per-group total-expense data for a finer ratio.
  const groupCards: GroupCardData[] = data.groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color ?? "#6366F1",
    icon: g.icon ?? g.name[0]?.toUpperCase() ?? "?",
    memberCount: g.memberCount,
    netBalancePaise: g.balancePaise,
    lastActivityDate: g.lastActivityAt,
    lastExpenseTitle: g.lastExpense?.title ?? null,
    settlementProgress: Number(g.balancePaise) === 0 ? 100 : 0,
  }));

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        handle: session.user.handle,
        image: session.user.image ?? null,
      }}
    >
      <FadeIn>
        <div className="space-y-8">
          <BalanceHero
            netBalancePaise={data.netBalancePaise}
            owedToYouPaise={owedToYouPaise}
            youOwePaise={youOwePaise}
            settledThisMonthPaise={data.settledThisMonthPaise}
            userName={displayName}
          />

          <QuickActions
            groups={groupCards.map((g) => ({
              id: g.id,
              name: g.name,
              icon: g.icon,
              memberCount: g.memberCount,
            }))}
          />

          <PendingActions pending={data.pending} />

          <GroupsSection groups={groupCards} />
        </div>
      </FadeIn>
    </DashboardShell>
  );
}
