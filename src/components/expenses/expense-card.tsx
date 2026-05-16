"use client";

import { m } from "framer-motion";
import { useRouter } from "next/navigation";

import { formatPaise } from "@/lib/format";

export interface ExpenseCardData {
  id: string;
  title: string;
  totalAmountPaise: string;
  date: Date;
  categoryName: string | null;
  categoryEmoji: string | null;
  paidByName: string;
  paidByYou: boolean;
  yourSharePaise: string;
  youPaidPaise: string;
  splitType: string;
  participantCount: number;
}

interface ExpenseCardProps extends ExpenseCardData {
  groupId: string;
}

const shortDateFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
});

export function ExpenseCard({
  id,
  groupId,
  title,
  totalAmountPaise,
  date,
  categoryEmoji,
  paidByYou,
  yourSharePaise,
  youPaidPaise,
  participantCount,
}: ExpenseCardProps) {
  const router = useRouter();

  const youOwe = Number(yourSharePaise) - Number(youPaidPaise);
  const icon = categoryEmoji ?? title[0]?.toUpperCase() ?? "?";
  const dateLabel = shortDateFmt.format(new Date(date));
  const splitLabel = participantCount > 1 ? `Split ${participantCount} ways` : "Just you";

  function handleClick() {
    router.push(`/groups/${groupId}/expenses/${id}`);
  }

  return (
    <m.div
      role="button"
      tabIndex={0}
      aria-label={`${title}, ${formatPaise(totalAmountPaise)}`}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#161B22] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896]"
      whileHover={{ borderColor: "rgba(255,255,255,0.08)" }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
    >
      {/* LEFT */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-sm leading-none"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#F5F7FA]">{title}</p>
          <p className="mt-0.5 text-xs text-[#8B93A7]">
            {dateLabel} · {splitLabel}
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex-shrink-0 text-right">
        <p className="text-[15px] font-semibold tabular-nums text-[#F5F7FA]">
          {formatPaise(totalAmountPaise)}
        </p>
        {youOwe === 0 ? (
          <p className="mt-0.5 text-[11px] text-[#8B93A7]">settled</p>
        ) : paidByYou && youOwe < 0 ? (
          <p className="mt-0.5 text-[11px] text-[#00C896]">
            you paid · owed {formatPaise(Math.abs(youOwe))}
          </p>
        ) : youOwe > 0 ? (
          <p className="mt-0.5 text-[11px] text-[#FF4757]">
            you owe {formatPaise(youOwe)}
          </p>
        ) : null}
      </div>
    </m.div>
  );
}
