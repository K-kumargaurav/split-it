import Link from "next/link";

import { GroupCard } from "@/components/dashboard/group-card";
import type { DashboardGroupSummary } from "@/server/dashboard/types";

interface GroupsListProps {
  groups: DashboardGroupSummary[];
}

export function GroupsList({ groups }: GroupsListProps) {
  return (
    <section aria-labelledby="groups-heading">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2
            id="groups-heading"
            className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
          >
            Your groups
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Sorted by most recent activity</p>
        </div>
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
            <GroupCard group={group} />
          </li>
        ))}
      </ul>
    </section>
  );
}
