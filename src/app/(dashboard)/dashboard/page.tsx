import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { GroupsList } from "@/components/dashboard/groups-list";
import { PendingActions } from "@/components/dashboard/pending-actions";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { getUserNetBalance } from "@/server/balance/calculate-balances";
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

  // Cross-group net is the sum of per-group nets from the balance module —
  // sourced through getUserNetBalance so it stays consistent with the
  // group-detail view (same algorithm, same direct ledger).
  const userId = session.user.id;
  const perGroupNets = await Promise.all(
    data.groups.map((g) => getUserNetBalance(g.id, userId)),
  );
  const netBalancePaise = Number(
    perGroupNets.reduce((sum, n) => sum + n, BigInt(0)),
  );

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        handle: session.user.handle,
        image: session.user.image ?? null,
      }}
    >
      <div className="space-y-8">
        <BalanceSummary
          netBalancePaise={netBalancePaise}
          groupCount={data.groups.length}
          displayName={displayName}
        />

        <PendingActions pending={data.pending} />

        <QuickActions hasGroups={hasGroups} />

        {hasGroups ? <GroupsList groups={data.groups} /> : <EmptyState />}
      </div>
    </DashboardShell>
  );
}
