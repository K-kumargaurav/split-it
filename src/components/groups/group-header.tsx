import Link from "next/link";
import { Settings } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import type { GroupDetail } from "@/server/groups/get-groups";

interface GroupHeaderProps {
  group: GroupDetail;
  showSettings?: boolean;
}

export function GroupHeader({ group, showSettings = false }: GroupHeaderProps) {
  const settled = group.balancePaise === 0;
  const owedToYou = group.balancePaise > 0;
  const balanceTone = settled
    ? { label: "All settled", color: "text-[#8B93A7]" }
    : owedToYou
      ? { label: "You're owed", color: "text-[#00C896]" }
      : { label: "You owe", color: "text-[#FF4757]" };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[#161B22] px-4 py-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: group.color ?? "#6366F1" }}
      >
        {group.icon ?? group.name[0]?.toUpperCase() ?? "?"}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[#F5F7FA]">{group.name}</p>
        <p className="text-[12px] text-[#8B93A7]">
          {group.members.length} {group.members.length === 1 ? "member" : "members"}
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-[11px] text-[#8B93A7]">{balanceTone.label}</p>
          <p className={cn("font-mono text-sm font-semibold tabular-nums", balanceTone.color)}>
            {settled ? "₹0.00" : formatPaise(Math.abs(group.balancePaise))}
          </p>
        </div>
        {showSettings && (
          <Link
            href={`/groups/${group.id}/settings`}
            aria-label="Group settings"
            className="text-[#8B93A7] transition-colors hover:text-[#F5F7FA]"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
