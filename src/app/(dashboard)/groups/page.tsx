import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { GroupCard } from "@/components/dashboard/group-card";
import { FadeIn } from "@/components/ui/motion";
import { getGroupsForUser } from "@/server/groups/get-groups";

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const groups = await getGroupsForUser(session.user.id);

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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-[#F5F7FA]">Groups</h1>
              <p className="text-sm text-[#8B93A7]">
                {groups.length} {groups.length === 1 ? "group" : "groups"}
              </p>
            </div>
            <Link
              href="/groups/new"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-[#00C896] px-4 text-sm font-semibold text-[#0E1116] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116]"
            >
              <Plus size={16} aria-hidden="true" />
              New Group
            </Link>
          </div>

          {/* Content */}
          {groups.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((g) => (
                <GroupCard
                  key={g.id}
                  id={g.id}
                  name={g.name}
                  color={g.color ?? "#6366F1"}
                  icon={g.icon ?? g.name[0]?.toUpperCase() ?? "?"}
                  memberCount={g.memberCount}
                  netBalancePaise={String(g.balancePaise)}
                  lastActivityDate={g.updatedAt}
                  lastExpenseTitle={null}
                  settlementProgress={g.balancePaise === 0 ? 100 : 0}
                />
              ))}
            </div>
          )}
        </div>
      </FadeIn>
    </DashboardShell>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-[#161B22] px-6 py-20 text-center shadow-card">
      <span className="mb-4 text-5xl" aria-hidden="true">
        👥
      </span>
      <h2 className="text-base font-semibold text-[#F5F7FA]">No groups yet</h2>
      <p className="mt-1 max-w-xs text-sm text-[#8B93A7]">
        Create a group to start tracking shared expenses with friends, roommates, or colleagues.
      </p>
      <Link
        href="/groups/new"
        className="mt-6 flex h-10 items-center gap-1.5 rounded-2xl bg-[#00C896] px-5 text-sm font-semibold text-[#0E1116] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116]"
      >
        <Plus size={16} aria-hidden="true" />
        Create your first group
      </Link>
    </div>
  );
}
