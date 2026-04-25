import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatPaise, formatRelativeTime } from "@/lib/format";
import type { DashboardGroupSummary } from "@/server/dashboard/types";

interface GroupCardProps {
  group: DashboardGroupSummary;
}

// SPEC §4.12 visual indicator:
//   green = others owe you in this group
//   red   = you owe in this group
//   grey  = settled
export function GroupCard({ group }: GroupCardProps) {
  const settled = group.balancePaise === 0;
  const owedToYou = group.balancePaise > 0;

  const tone = settled
    ? { bar: "bg-slate-200", chip: "bg-slate-100 text-slate-600", label: "Settled", amountClass: "text-slate-500" }
    : owedToYou
      ? { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", label: "You're owed", amountClass: "text-emerald-700" }
      : { bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700", label: "You owe", amountClass: "text-rose-700" };

  const monogramBg = group.color ?? "#6366F1"; // indigo-500 fallback

  return (
    <Link
      href={`/groups/${group.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition",
        "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", tone.bar)} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-base font-semibold text-white"
            style={{ backgroundColor: monogramBg }}
          >
            {group.icon ?? group.name[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-slate-900">
              {group.name}
            </h3>
            <p className="text-xs text-slate-500">
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

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>Active {formatRelativeTime(group.lastActivityAt)}</span>
        <span
          aria-hidden="true"
          className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600"
        >
          →
        </span>
      </div>
    </Link>
  );
}
