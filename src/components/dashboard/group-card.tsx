import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatDate, formatPaise, formatRelativeTime } from "@/lib/format";
import type { DashboardGroupMember, DashboardGroupSummary } from "@/server/dashboard/types";

interface GroupCardProps {
  group: DashboardGroupSummary;
}

// SPEC §4.12 visual indicator:
//   green = others owe you in this group
//   red   = you owe in this group
//   grey  = settled
//
// The whole card is the link target so a tap anywhere navigates — no inner
// links inside the <Link> (would nest <a>s and trip a11y/HTML validity).
export function GroupCard({ group }: GroupCardProps) {
  const settled = group.balancePaise === 0;
  const owedToYou = group.balancePaise > 0;

  const tone = settled
    ? {
        bar: "bg-slate-200 dark:bg-slate-700",
        chip: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
        label: "Settled",
        amountClass: "text-slate-500 dark:text-slate-400",
      }
    : owedToYou
      ? {
          bar: "bg-emerald-500",
          chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
          label: "You're owed",
          amountClass: "text-emerald-700 dark:text-emerald-300",
        }
      : {
          bar: "bg-rose-500",
          chip: "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
          label: "You owe",
          amountClass: "text-rose-700 dark:text-rose-300",
        };

  const monogramBg = group.color ?? "#6366F1";
  const extraMembers = Math.max(0, group.memberCount - group.members.length);

  return (
    <Link
      href={`/groups/${group.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition",
        "hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg",
        "active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", tone.bar)} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-base font-semibold text-white"
            style={{ backgroundColor: monogramBg }}
          >
            {group.icon ?? group.name[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              {group.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", tone.chip)}>
          {tone.label}
        </span>
        <p className={cn("mt-2 font-mono text-xl font-semibold tabular-nums", tone.amountClass)}>
          {settled ? "₹0.00" : formatPaise(Math.abs(group.balancePaise))}
        </p>
      </div>

      {group.lastExpense ? (
        <p className="mt-4 truncate text-xs text-slate-500 dark:text-slate-400">
          <span className="text-slate-400 dark:text-slate-500">Last:</span>{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">{group.lastExpense.title}</span>
          <span className="text-slate-400 dark:text-slate-500"> · {formatDate(group.lastExpense.date)}</span>
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500 dark:text-slate-400">
        <AvatarStack members={group.members} extraCount={extraMembers} />
        <span className="flex items-center gap-2">
          <span>{formatRelativeTime(group.lastActivityAt)}</span>
          <span
            aria-hidden="true"
            className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-300"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

function AvatarStack({
  members,
  extraCount,
}: {
  members: DashboardGroupMember[];
  extraCount: number;
}) {
  if (members.length === 0) return <span aria-hidden="true" />;
  return (
    <div className="flex -space-x-2" aria-hidden="true">
      {members.map((m) => (
        <Avatar key={m.id} member={m} />
      ))}
      {extraCount > 0 ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
          +{extraCount}
        </span>
      ) : null}
    </div>
  );
}

function Avatar({ member }: { member: DashboardGroupMember }) {
  const initial = member.displayName[0]?.toUpperCase() ?? "?";
  if (member.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatarUrl}
        alt=""
        className="h-7 w-7 rounded-full border-2 border-white dark:border-slate-900 object-cover"
      />
    );
  }
  return (
    <span
      title={member.displayName}
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-indigo-500 text-[10px] font-semibold text-white"
    >
      {initial}
    </span>
  );
}
