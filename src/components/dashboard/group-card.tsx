"use client";

import { useRouter } from "next/navigation";
import { m } from "framer-motion";

import { formatPaise, formatRelativeTime } from "@/lib/format";

export interface GroupCardData {
  id: string;
  name: string;
  color: string;
  icon: string;
  memberCount: number;
  netBalancePaise: string;
  lastActivityDate: Date | null;
  lastExpenseTitle: string | null;
  settlementProgress: number; // 0–100
}

export function GroupCard({
  id,
  name,
  color,
  icon,
  memberCount,
  netBalancePaise,
  lastActivityDate,
  lastExpenseTitle,
  settlementProgress,
}: GroupCardData) {
  const router = useRouter();
  const balance = Number(netBalancePaise);
  const isPositive = balance > 0;
  const isNegative = balance < 0;

  const balanceColor = isPositive
    ? "text-[#00C896]"
    : isNegative
      ? "text-[#FF4757]"
      : "text-[#8B93A7]";

  const statusLabel = isPositive ? "You're owed" : isNegative ? "You owe" : "Settled";

  const activityText =
    lastActivityDate != null ? formatRelativeTime(lastActivityDate) : null;

  const metaLine = [
    `${memberCount} ${memberCount === 1 ? "member" : "members"}`,
    activityText,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <m.div
      role="link"
      tabIndex={0}
      aria-label={`${name} group — ${statusLabel} ${balance !== 0 ? formatPaise(Math.abs(balance)) : ""}`}
      className="flex cursor-pointer flex-col gap-4 rounded-3xl border border-white/5 bg-[#161B22] p-5 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116]"
      whileHover={{ y: -2, borderColor: "rgba(255,255,255,0.1)" }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      onClick={() => router.push(`/groups/${id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push(`/groups/${id}`);
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        {/* Left: icon + name + meta */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm"
            style={{ backgroundColor: color }}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-snug text-[#F5F7FA]">
              {name}
            </p>
            <p className="text-xs text-[#8B93A7]">{metaLine}</p>
          </div>
        </div>

        {/* Right: balance */}
        <div className="flex-shrink-0 text-right">
          <p className={`text-base font-semibold tabular-nums ${balanceColor}`}>
            {balance !== 0 ? formatPaise(Math.abs(balance)) : "₹0"}
          </p>
          <p className={`text-xs ${balanceColor}`}>{statusLabel}</p>
        </div>
      </div>

      {/* Last expense preview */}
      {lastExpenseTitle != null && (
        <>
          <div className="h-px bg-white/[0.04]" aria-hidden="true" />
          <p className="truncate text-xs text-[#8B93A7]">
            ↳ {lastExpenseTitle}
          </p>
        </>
      )}

      {/* Settlement progress bar */}
      <div className="h-0.5 overflow-hidden rounded-full bg-white/5">
        <m.div
          className="h-full rounded-full bg-[#00C896]"
          initial={{ width: "0%" }}
          whileInView={{ width: `${settlementProgress}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </m.div>
  );
}
