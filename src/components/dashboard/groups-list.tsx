import Link from "next/link";

import { GroupCard } from "@/components/dashboard/group-card";
import type { DashboardGroupSummary } from "@/server/dashboard/types";

interface GroupsListProps {
  groups: DashboardGroupSummary[];
}

// Legacy wrapper — new dashboards use GroupsSection instead.
// Kept to avoid breaking any non-dashboard pages that may reference this.
export function GroupsList({ groups }: GroupsListProps) {
  return (
    <section aria-labelledby="groups-heading">
      <div className="mb-4 flex items-end justify-between">
        <h2
          id="groups-heading"
          className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          Your groups
        </h2>
        <Link
          href="/groups"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          View all →
        </Link>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <li key={group.id}>
            <GroupCard
              id={group.id}
              name={group.name}
              color={group.color ?? "#6366F1"}
              icon={group.icon ?? group.name[0]?.toUpperCase() ?? "?"}
              memberCount={group.memberCount}
              netBalancePaise={group.balancePaise}
              lastActivityDate={group.lastActivityAt}
              lastExpenseTitle={group.lastExpense?.title ?? null}
              settlementProgress={Number(group.balancePaise) === 0 ? 100 : 0}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
