"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/cn";
import { formatDate, formatPaise } from "@/lib/format";
import { ToggleSwitch } from "@/components/ui/toggle-switch";

type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const SPLIT_LABEL: Record<SplitType, string> = {
  EQUAL: "Equal",
  EXACT: "Exact",
  PERCENTAGE: "Percentage",
};

export interface RecurringCardProps {
  groupId: string;
  templateId: string;
  title: string;
  amountPaise: string;
  frequency: Frequency;
  splitType: SplitType;
  participantCount: number;
  nextRunDate: Date;
  endDate: Date | null;
  isActive: boolean;
}

export function RecurringCard({
  groupId,
  templateId,
  title,
  amountPaise,
  frequency,
  splitType,
  participantCount,
  nextRunDate,
  endDate,
  isActive: initialActive,
}: RecurringCardProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(initialActive);
  const [busy, setBusy] = useState<"toggle" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean): Promise<void> {
    if (busy) return;
    setIsActive(next);
    setBusy("toggle");
    setError(null);
    try {
      const res = await fetch(`/api/v1/groups/${groupId}/recurring/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        setIsActive(!next);
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(json?.error?.message ?? "Couldn't update.");
        return;
      }
      router.refresh();
    } catch {
      setIsActive(!next);
      setError("Couldn't update.");
    } finally {
      setBusy(null);
    }
  }

  async function destroy(): Promise<void> {
    if (!window.confirm("Delete this recurring expense? Past entries stay intact.")) return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/v1/groups/${groupId}/recurring/${templateId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(json?.error?.message ?? "Couldn't delete.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't delete.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <motion.div
      className={cn(
        "group relative rounded-2xl bg-[#161B22] shadow-card",
        "border border-white/5 border-l-2",
        isActive ? "border-l-[#00C896]" : "border-l-white/10 opacity-60",
      )}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="px-5 py-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ background: "rgba(0,200,150,0.15)" }}
              aria-hidden="true"
            >
              🔁
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[15px] font-medium text-[#F5F7FA]">{title}</p>
                <span className="shrink-0 rounded-full bg-[rgba(0,200,150,0.1)] px-2 py-0.5 text-[11px] text-[#00C896]">
                  {FREQUENCY_LABEL[frequency]}
                </span>
              </div>
            </div>
          </div>
          {/* Amount + toggle */}
          <div className="flex shrink-0 flex-col items-end gap-2">
            <p className="text-[16px] font-semibold tabular-nums text-[#F5F7FA]">
              {formatPaise(amountPaise)}
            </p>
            <ToggleSwitch
              checked={isActive}
              onChange={toggle}
              aria-label={isActive ? "Pause recurring expense" : "Resume recurring expense"}
            />
          </div>
        </div>

        {/* Middle row */}
        <p className="mt-2 text-[12px] text-[#8B93A7]">
          {participantCount} participant{participantCount === 1 ? "" : "s"} ·{" "}
          {SPLIT_LABEL[splitType]} split
        </p>

        {/* Bottom row */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#8B93A7]">
            <span>Next run:</span>
            <span className="text-[12px] font-medium text-[#F5F7FA]">
              {formatDate(nextRunDate)}
            </span>
            {endDate ? (
              <>
                <span>·</span>
                <span>Ends {formatDate(endDate)}</span>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={destroy}
            disabled={busy !== null}
            aria-label="Delete recurring expense"
            className={cn(
              "rounded p-0.5 text-[#FF4757] transition-opacity",
              "opacity-0 group-hover:opacity-100",
              "hover:text-[#FF4757]/70 focus-visible:opacity-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4757]",
              "disabled:cursor-not-allowed",
            )}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-1.5 text-[11px] text-[#FF4757]">
            {error}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
