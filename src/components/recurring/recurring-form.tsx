"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatDate, formatPaise, rupeesToPaise } from "@/lib/format";
import { equalSplit, percentageSplit } from "@/lib/split";

interface MemberOption {
  id: string;
  displayName: string;
  handle: string;
}

interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
}

interface RecurringFormProps {
  groupId: string;
  viewerId: string;
  members: MemberOption[];
  categories: CategoryOption[];
}

type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE";
type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every two weeks" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

const RUPEE_PATTERN = /^\d+(\.\d{1,2})?$/;

export function RecurringForm({
  groupId,
  viewerId,
  members,
  categories,
}: RecurringFormProps) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("MONTHLY");
  const [nextRunDate, setNextRunDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [participantIds, setParticipantIds] = useState<string[]>(
    members.map((m) => m.id),
  );
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPaise = useMemo(() => {
    if (!RUPEE_PATTERN.test(amount.trim())) return 0;
    try {
      return Number(rupeesToPaise(amount));
    } catch {
      return 0;
    }
  }, [amount]);

  // Preview the upcoming runs by walking the same advance algorithm the cron
  // uses. Pure UI — keeps the user oriented about what dates they're signing
  // up for before clicking save.
  const upcomingRuns = useMemo(() => {
    if (!nextRunDate) return [];
    let current = new Date(`${nextRunDate}T00:00:00Z`);
    if (Number.isNaN(current.getTime())) return [];
    const end = endDate ? new Date(`${endDate}T00:00:00Z`) : null;
    const out: Date[] = [];
    for (let i = 0; i < 4; i++) {
      if (end && current > end) break;
      out.push(current);
      current = advance(current, frequency);
    }
    return out;
  }, [nextRunDate, endDate, frequency]);

  function toggleParticipant(id: string): void {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  const exactState = useMemo(() => {
    if (splitType !== "EXACT") return null;
    let sum = 0;
    let allFilled = true;
    const rows = participantIds.map((id) => {
      const raw = (exactInputs[id] ?? "").trim();
      if (raw === "") allFilled = false;
      let paise = 0;
      if (RUPEE_PATTERN.test(raw)) {
        try {
          paise = Number(rupeesToPaise(raw));
        } catch {
          paise = 0;
        }
      }
      sum += paise;
      return { id, paise };
    });
    return {
      rows,
      sum,
      remaining: totalPaise - sum,
      valid: totalPaise > 0 && sum === totalPaise && allFilled && rows.length > 0,
    };
  }, [splitType, participantIds, exactInputs, totalPaise]);

  const percentState = useMemo(() => {
    if (splitType !== "PERCENTAGE") return null;
    let sum = 0;
    let allFilled = true;
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
      try {
        preview = percentageSplit(totalPaise, pcts);
      } catch {
        preview = null;
      }
    }
    return {
      pcts,
      sum,
      preview,
      valid: totalPaise > 0 && sum === 100 && allFilled && pcts.length > 0,
    };
  }, [splitType, participantIds, percentInputs, totalPaise]);

  const equalPreview = useMemo(() => {
    if (splitType !== "EQUAL") return null;
    if (totalPaise < 1 || participantIds.length === 0) return null;
    try {
      return equalSplit(totalPaise, participantIds.length);
    } catch {
      return null;
    }
  }, [splitType, totalPaise, participantIds]);

  const splitValid =
    splitType === "EQUAL"
      ? Boolean(equalPreview)
      : splitType === "EXACT"
        ? Boolean(exactState?.valid)
        : Boolean(percentState?.valid);

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
      participantConfig = {
        splitType: "EXACT",
        splits: exactState.rows.map((r) => ({ userId: r.id, amountPaise: r.paise })),
      };
    } else if (splitType === "PERCENTAGE" && percentState) {
      participantConfig = {
        splitType: "PERCENTAGE",
        splits: participantIds.map((id, i) => ({
          userId: id,
          percentage: percentState.pcts[i] ?? 0,
        })),
      };
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/groups/${groupId}/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          categoryId: categoryId || null,
          amountPaise: totalPaise,
          frequency,
          nextRunDate,
          endDate: endDate ? endDate : null,
          participantConfig,
        }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(json?.error?.message ?? "Couldn't save the recurring expense.");
        return;
      }
      router.push(`/groups/${groupId}/recurring`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="r-title" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Title
        </label>
        <input
          id="r-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Rent · Internet · Gym membership"
          className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="r-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Amount (₹)
          </label>
          <input
            id="r-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="r-category" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Category
          </label>
          <select
            id="r-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? `${c.emoji} ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Frequency
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {FREQUENCY_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFrequency(f.value)}
              aria-pressed={frequency === f.value}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                frequency === f.value
                  ? "border-indigo-500 bg-indigo-50/40 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-100"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="r-next" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            First occurrence
          </label>
          <input
            id="r-next"
            type="date"
            value={nextRunDate}
            onChange={(e) => setNextRunDate(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="r-end" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            End date <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="r-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {upcomingRuns.length > 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
          Upcoming runs:{" "}
          {upcomingRuns.map((d, i) => (
            <span key={i} className="ml-1 font-mono tabular-nums">
              {formatDate(d)}
              {i < upcomingRuns.length - 1 ? " · " : ""}
            </span>
          ))}
        </div>
      ) : null}

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Split among
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600"
            >
              <input
                type="checkbox"
                checked={participantIds.includes(m.id)}
                onChange={() => toggleParticipant(m.id)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="truncate">
                {m.displayName}
                {m.id === viewerId ? <span className="ml-1 text-xs text-slate-400">(you)</span> : null}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Split type
        </legend>
        <div role="tablist" className="mt-2 inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1">
          {(["EQUAL", "EXACT", "PERCENTAGE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={splitType === t}
              onClick={() => setSplitType(t)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                splitType === t
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              {t === "EQUAL" ? "Equal" : t === "EXACT" ? "Exact" : "Percentage"}
            </button>
          ))}
        </div>
      </fieldset>

      {splitType === "EQUAL" && equalPreview ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
          Each person owes{" "}
          <span className="font-mono font-semibold text-slate-900 dark:text-white">
            {formatPaise(equalPreview[0]!)}
          </span>
          .
        </div>
      ) : null}

      {splitType === "EXACT" && exactState ? (
        <div className="space-y-2">
          {participantIds.map((id) => {
            const member = members.find((m) => m.id === id);
            if (!member) return null;
            return (
              <div key={id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                  {member.displayName}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={exactInputs[id] ?? ""}
                  onChange={(e) =>
                    setExactInputs((prev) => ({ ...prev, [id]: e.target.value }))
                  }
                  className="w-28 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-right font-mono text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            );
          })}
          <p
            className={cn(
              "text-xs font-medium",
              exactState.remaining === 0
                ? "text-emerald-700"
                : exactState.remaining < 0
                  ? "text-rose-700"
                  : "text-slate-600 dark:text-slate-300",
            )}
          >
            {exactState.remaining === 0
              ? "Allocated exactly."
              : exactState.remaining < 0
                ? `Over by ${formatPaise(-exactState.remaining)}`
                : `${formatPaise(exactState.remaining)} remaining to allocate`}
          </p>
        </div>
      ) : null}

      {splitType === "PERCENTAGE" && percentState ? (
        <div className="space-y-2">
          {participantIds.map((id, i) => {
            const member = members.find((m) => m.id === id);
            if (!member) return null;
            return (
              <div key={id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                  {member.displayName}
                </span>
                <div className="flex items-center gap-3">
                  {percentState.preview ? (
                    <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {formatPaise(percentState.preview[i] ?? 0)}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={percentInputs[id] ?? ""}
                      onChange={(e) =>
                        setPercentInputs((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                      className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-right font-mono text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">%</span>
                  </div>
                </div>
              </div>
            );
          })}
          <p
            className={cn(
              "text-xs font-medium",
              percentState.sum === 100
                ? "text-emerald-700"
                : percentState.sum > 100
                  ? "text-rose-700"
                  : "text-slate-600 dark:text-slate-300",
            )}
          >
            {percentState.sum === 100
              ? "100% allocated."
              : `${(100 - percentState.sum).toFixed(2)}% remaining.`}
          </p>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push(`/groups/${groupId}/recurring`)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !splitValid || !title.trim() || !nextRunDate}
          className={cn(
            "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
            "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {submitting ? "Saving…" : "Save recurring expense"}
        </button>
      </div>
    </form>
  );
}

// Mirrors `advanceNextRunDate` in src/server/recurring/process-recurring.ts.
// Duplicated here as pure UI math so the preview matches the cron exactly
// without an extra round-trip; kept tiny and tested by parity, not a fork.
function advance(from: Date, freq: Frequency): Date {
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
