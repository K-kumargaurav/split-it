import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { BalanceHero } from "@/components/dashboard/balance-hero";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { GroupsList } from "@/components/dashboard/groups-list";
import { PendingActions } from "@/components/dashboard/pending-actions";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { FadeIn } from "@/components/ui/motion";
import { getDashboardData } from "@/server/dashboard/get-dashboard-data";

// Fully-RSC dashboard. Middleware (auth-edge) already rejects unauthenticated
// requests; the redirect here is a defence-in-depth fallback for the rare
// case where the session cookie is present but the user record is gone.
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const data = await getDashboardData(session.user.id);
  const hasGroups = data.groups.length > 0;
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

          <QuickActions />

          <PendingActions pending={data.pending} />

          {hasGroups ? <GroupsList groups={data.groups} /> : <EmptyState />}
        </div>
      </FadeIn>
    </DashboardShell>
  );
}
