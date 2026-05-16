"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { m } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/cn";
import { formatDate, formatPaise, rupeesToPaise } from "@/lib/format";
import { equalSplit, percentageSplit } from "@/lib/split";
import { AmountInput } from "@/components/ui/amount-input";
import { MemberSelector } from "@/components/ui/member-selector";
import { PremiumInput } from "@/components/ui/premium-input";
import {
  advance,
  ExactInputs,
  FREQ_OPTIONS,
  PercentInputs,
  type Frequency,
  type SplitType,
} from "./split-amount-inputs";

interface MemberOption { id: string; displayName: string; handle: string }
interface RecurringFormProps { groupId: string; members: MemberOption[] }

const RUPEE_PATTERN = /^\d+(\.\d{1,2})?$/;

function parsePaise(raw: string): number {
  if (!RUPEE_PATTERN.test(raw.trim())) return 0;
  try { return Number(rupeesToPaise(raw)); } catch { return 0; }
}

export function RecurringForm({ groupId, members }: RecurringFormProps) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("MONTHLY");
  const [, startTransition] = useTransition();
  const [nextRunDate, setNextRunDate] = useState(today);
  const [showEndDate, setShowEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [participantIds, setParticipantIds] = useState<string[]>(members.map((m) => m.id));
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPaise = useMemo(() => parsePaise(amount), [amount]);

  const upcomingRuns = useMemo(() => {
    if (!nextRunDate) return [];
    let cur = new Date(`${nextRunDate}T00:00:00Z`);
    if (Number.isNaN(cur.getTime())) return [];
    const end = endDate ? new Date(`${endDate}T00:00:00Z`) : null;
    const out: Date[] = [];
    for (let i = 0; i < 3; i++) {
      if (end && cur > end) break;
      out.push(cur);
      cur = advance(cur, frequency);
    }
    return out;
  }, [nextRunDate, endDate, frequency]);

  function toggleParticipant(id: string): void {
    setParticipantIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  const exactState = useMemo(() => {
    if (splitType !== "EXACT") return null;
    let sum = 0; let allFilled = true;
    const rows = participantIds.map((id) => {
      const raw = (exactInputs[id] ?? "").trim();
      if (raw === "") allFilled = false;
      const paise = parsePaise(raw);
      sum += paise;
      return { id, paise };
    });
    return { rows, sum, remaining: totalPaise - sum, valid: totalPaise > 0 && sum === totalPaise && allFilled && rows.length > 0 };
  }, [splitType, participantIds, exactInputs, totalPaise]);

  const percentState = useMemo(() => {
    if (splitType !== "PERCENTAGE") return null;
    let sum = 0; let allFilled = true;
    const pcts = participantIds.map((id) => {
      const raw = (percentInputs[id] ?? "").trim();
      if (raw === "") allFilled = false;
      const n = Number(raw);
      const pct = Number.isFinite(n) && n >= 0 ? n : 0;
      sum += pct;
      return pct;
    });
    let preview: number[] | null = null;
    if (totalPaise > 0 && sum === 100 && allFilled) {
      try { preview = percentageSplit(totalPaise, pcts); } catch { preview = null; }
    }
    return { pcts, sum, preview, valid: totalPaise > 0 && sum === 100 && allFilled && pcts.length > 0 };
  }, [splitType, participantIds, percentInputs, totalPaise]);

  const equalPreview = useMemo(() => {
    if (splitType !== "EQUAL" || totalPaise < 1 || participantIds.length === 0) return null;
    try { return equalSplit(totalPaise, participantIds.length); } catch { return null; }
  }, [splitType, totalPaise, participantIds]);

  const splitValid = splitType === "EQUAL" ? Boolean(equalPreview) : splitType === "EXACT" ? Boolean(exactState?.valid) : Boolean(percentState?.valid);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Title is required.");
    if (totalPaise <= 0) return setError("Enter a valid amount.");
    if (!nextRunDate) return setError("Pick the first occurrence date.");
    if (!splitValid) return setError("Resolve the split before saving.");

    let participantConfig: unknown;
    if (splitType === "EQUAL") {
      participantConfig = { splitType: "EQUAL", participantIds };
    } else if (splitType === "EXACT" && exactState) {
      participantConfig = { splitType: "EXACT", splits: exactState.rows.map((r) => ({ userId: r.id, amountPaise: r.paise })) };
    } else if (splitType === "PERCENTAGE" && percentState) {
      participantConfig = { splitType: "PERCENTAGE", splits: participantIds.map((id, i) => ({ userId: id, percentage: percentState.pcts[i] ?? 0 })) };
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/groups/${groupId}/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), categoryId: null, amountPaise: totalPaise, frequency, nextRunDate, endDate: endDate || null, participantConfig }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(json?.error?.message ?? "Couldn't save the recurring expense.");
        return;
      }
      toast.success("Recurring expense set up");
      startTransition(() => {
        router.push(`/groups/${groupId}/recurring`);
        router.refresh();
      });
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <PremiumInput label="Title" id="r-title" type="text" value={title}
        onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Monthly Rent" />

      <div>
        <p className="mb-3 text-[13px] text-[#8B93A7]">Amount</p>
        <AmountInput value={amount} onChange={setAmount} />
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] text-[#8B93A7]">Frequency</legend>
        <div className="flex flex-wrap gap-2">
          {FREQ_OPTIONS.map((f) => (
            <m.button key={f.value} type="button" aria-pressed={frequency === f.value}
              onClick={() => setFrequency(f.value)} whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn("rounded-full px-4 py-2 text-sm transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896]",
                frequency === f.value
                  ? "bg-[#00C896] font-semibold text-[#0E1116]"
                  : "border border-white/[0.06] bg-white/[0.04] font-medium text-[#8B93A7] hover:text-[#F5F7FA]")}>
              {f.label}
            </m.button>
          ))}
        </div>
      </fieldset>

      <div>
        <PremiumInput label="First run" id="r-next" type="date" value={nextRunDate}
          onChange={(e) => setNextRunDate(e.target.value)} min={today} />
        {upcomingRuns.length > 0 ? (
          <p className="mt-1.5 text-[12px] text-[#8B93A7]">
            Next {upcomingRuns.length} occurrence{upcomingRuns.length > 1 ? "s" : ""}:{" "}
            {upcomingRuns.map((d, i) => <span key={i}>{i > 0 && " · "}{formatDate(d)}</span>)}
          </p>
        ) : null}
      </div>

      <div>
        {showEndDate ? (
          <div className="space-y-1.5">
            <PremiumInput label="End date (optional)" id="r-end" type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)} min={nextRunDate || today} />
            <button type="button" onClick={() => { setShowEndDate(false); setEndDate(""); }}
              className="text-[12px] text-[#8B93A7] transition-colors hover:text-[#F5F7FA]">
              Remove end date
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowEndDate(true)}
            className="text-[13px] text-[#00C896] transition-colors hover:text-[#00C896]/80">
            + Add end date
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 text-[13px] text-[#8B93A7]">Split among</p>
        <MemberSelector members={members.map((m) => ({ id: m.id, displayName: m.displayName, handle: m.handle }))}
          selected={participantIds} onToggle={toggleParticipant} mode="multi" />
      </div>

      <div>
        <p className="mb-2 text-[13px] text-[#8B93A7]">Split type</p>
        <div role="tablist" className="inline-flex rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          {(["EQUAL", "EXACT", "PERCENTAGE"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={splitType === t}
              onClick={() => setSplitType(t)}
              className={cn("rounded-xl px-3.5 py-1.5 text-sm font-medium transition",
                splitType === t ? "bg-[#161B22] text-[#F5F7FA] shadow-sm" : "text-[#8B93A7] hover:text-[#F5F7FA]")}>
              {t === "EQUAL" ? "Equal" : t === "EXACT" ? "Exact" : "Percentage"}
            </button>
          ))}
        </div>
        {splitType === "EQUAL" && equalPreview ? (
          <p className="mt-2 text-[12px] text-[#8B93A7]">
            Each person owes{" "}
            <span className="font-medium text-[#F5F7FA]">{formatPaise(equalPreview[0]!)}</span>
          </p>
        ) : null}
        {splitType === "EXACT" && exactState ? (
          <ExactInputs participantIds={participantIds} members={members} exactInputs={exactInputs}
            exactState={exactState} onChange={(id, val) => setExactInputs((p) => ({ ...p, [id]: val }))} />
        ) : null}
        {splitType === "PERCENTAGE" && percentState ? (
          <PercentInputs participantIds={participantIds} members={members} percentInputs={percentInputs}
            percentState={percentState} onChange={(id, val) => setPercentInputs((p) => ({ ...p, [id]: val }))} />
        ) : null}
      </div>

      {error ? (
        <div role="alert" aria-live="polite"
          className="rounded-xl border border-[#FF4757]/20 bg-[#FF4757]/10 px-4 py-3 text-sm text-[#FF4757]">
          {error}
        </div>
      ) : null}

      <button type="submit" disabled={submitting || !splitValid || !title.trim() || !nextRunDate}
        className={cn("flex h-12 w-full items-center justify-center rounded-xl bg-[#00C896]",
          "text-sm font-semibold text-[#0E1116] transition",
          "hover:bg-[#00C896]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896]",
          "disabled:cursor-not-allowed disabled:opacity-50")}>
        {submitting ? "Saving…" : "Create recurring expense"}
      </button>
    </form>
  );
}
