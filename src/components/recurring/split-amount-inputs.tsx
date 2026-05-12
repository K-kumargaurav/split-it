"use client";

import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";

export type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
export type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE";

export const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Biweekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

// Mirrors advanceNextRunDate in src/server/recurring/process-recurring.ts.
// Pure UI math for the occurrences preview — kept in sync by parity.
export function advance(from: Date, freq: Frequency): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  switch (freq) {
    case "DAILY":
      return new Date(Date.UTC(y, m, d + 1));
    case "WEEKLY":
      return new Date(Date.UTC(y, m, d + 7));
    case "BIWEEKLY":
      return new Date(Date.UTC(y, m, d + 14));
    case "MONTHLY": {
      const lastDay = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
      return new Date(Date.UTC(y, m + 1, Math.min(d, lastDay)));
    }
    case "YEARLY": {
      const lastDay = new Date(Date.UTC(y + 1, m + 1, 0)).getUTCDate();
      return new Date(Date.UTC(y + 1, m, Math.min(d, lastDay)));
    }
  }
}

interface Member {
  id: string;
  displayName: string;
}

interface ExactState {
  remaining: number;
}

interface PercentState {
  sum: number;
  preview: number[] | null;
}

interface ExactInputsProps {
  participantIds: string[];
  members: Member[];
  exactInputs: Record<string, string>;
  exactState: ExactState;
  onChange: (id: string, value: string) => void;
}

export function ExactInputs({
  participantIds,
  members,
  exactInputs,
  exactState,
  onChange,
}: ExactInputsProps) {
  return (
    <div className="mt-3 space-y-2">
      {participantIds.map((id) => {
        const member = members.find((m) => m.id === id);
        if (!member) return null;
        return (
          <div key={id} className="flex items-center justify-between gap-3">
            <span className="truncate text-sm text-[#8B93A7]">{member.displayName}</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={exactInputs[id] ?? ""}
              onChange={(e) => onChange(id, e.target.value)}
              className="w-28 rounded-xl border border-white/[0.06] bg-card px-3 py-1.5 text-right font-mono text-sm text-[#F5F7FA] focus:border-[#00C896] focus:outline-none focus:ring-1 focus:ring-[#00C896]/10"
            />
          </div>
        );
      })}
      <p className={cn("text-[12px] font-medium",
        exactState.remaining === 0 ? "text-[#00C896]"
          : exactState.remaining < 0 ? "text-[#FF4757]" : "text-[#8B93A7]")}>
        {exactState.remaining === 0
          ? "Allocated exactly."
          : exactState.remaining < 0
            ? `Over by ${formatPaise(-exactState.remaining)}`
            : `${formatPaise(exactState.remaining)} remaining`}
      </p>
    </div>
  );
}

interface PercentInputsProps {
  participantIds: string[];
  members: Member[];
  percentInputs: Record<string, string>;
  percentState: PercentState;
  onChange: (id: string, value: string) => void;
}

export function PercentInputs({
  participantIds,
  members,
  percentInputs,
  percentState,
  onChange,
}: PercentInputsProps) {
  return (
    <div className="mt-3 space-y-2">
      {participantIds.map((id, i) => {
        const member = members.find((m) => m.id === id);
        if (!member) return null;
        return (
          <div key={id} className="flex items-center justify-between gap-3">
            <span className="truncate text-sm text-[#8B93A7]">{member.displayName}</span>
            <div className="flex items-center gap-2">
              {percentState.preview ? (
                <span className="font-mono text-[11px] tabular-nums text-[#8B93A7]">
                  {formatPaise(percentState.preview[i] ?? 0)}
                </span>
              ) : null}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={percentInputs[id] ?? ""}
                  onChange={(e) => onChange(id, e.target.value)}
                  className="w-20 rounded-xl border border-white/[0.06] bg-card px-3 py-1.5 text-right font-mono text-sm text-[#F5F7FA] focus:border-[#00C896] focus:outline-none focus:ring-1 focus:ring-[#00C896]/10"
                />
                <span className="text-[11px] text-[#8B93A7]">%</span>
              </div>
            </div>
          </div>
        );
      })}
      <p className={cn("text-[12px] font-medium",
        percentState.sum === 100 ? "text-[#00C896]"
          : percentState.sum > 100 ? "text-[#FF4757]" : "text-[#8B93A7]")}>
        {percentState.sum === 100
          ? "100% allocated."
          : `${(100 - percentState.sum).toFixed(2)}% remaining.`}
      </p>
    </div>
  );
}
