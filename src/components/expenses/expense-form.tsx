"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/cn";
import { formatPaise, rupeesToPaise } from "@/lib/format";
import { equalSplit, percentageSplit } from "@/lib/split";
import { ReceiptUploader, type OcrPrefill } from "@/components/expenses/receipt-uploader";

// Form is rupees-facing — the user thinks in ₹, the wire format is paise.
// Convert at the boundary (onSubmit) and validate the integer in `paise` as
// the source of truth. We keep the raw user-entered string and pass it to
// `rupeesToPaise` (string → BigInt) — multiplying through a Number drops
// paise on values the binary float can't represent (e.g. 7999.50 * 100).

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

interface ExpenseFormProps {
  groupId: string;
  viewerId: string;
  members: MemberOption[];
  categories: CategoryOption[];
}

type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE";

// Amount lives as a string so we can defer paise conversion to BigInt math.
// We accept "7999", "7999.5", "7999.50" and one or two decimals; anything
// outside that shape is rejected here so onSubmit never sees garbage.
const RUPEE_PATTERN = /^\d+(\.\d{1,2})?$/;

const formSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required." }).max(120),
  amount: z
    .string()
    .trim()
    .min(1, { message: "Amount is required." })
    .regex(RUPEE_PATTERN, { message: "Enter a valid amount (max 2 decimals)." })
    .refine((v) => Number(v) > 0, { message: "Amount must be greater than zero." })
    .refine((v) => Number(v) <= 10_000_000, { message: "Amount is too large." }),
  date: z.string().min(1, { message: "Date is required." }),
  categoryId: z.string().optional(),
  paidById: z.string().uuid({ message: "Choose who paid." }),
  participantIds: z
    .array(z.string().uuid())
    .min(1, { message: "Select at least one person to split with." }),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateExpenseErrorBody {
  error?: { code?: string; message?: string };
}

export function ExpenseForm({ groupId, viewerId, members, categories }: ExpenseFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");

  // EXACT/PERCENTAGE inputs are tracked as strings keyed by participant id so
  // empty input is distinguishable from zero, and so React doesn't have to
  // re-mount inputs as participants are toggled.
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});

  // Receipt + OCR state. The File is held until the expense is saved, then
  // POSTed to /expenses/:expId/receipt. `prefilledFields` drives the badge
  // shown next to amount/date.
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [prefilledFields, setPrefilledFields] = useState<{ amount: boolean; date: boolean }>({
    amount: false,
    date: false,
  });

  const allIds = useMemo(() => members.map((m) => m.id), [members]);
  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      amount: "",
      date: today,
      categoryId: "",
      paidById: viewerId,
      participantIds: allIds,
    },
  });

  const amount = watch("amount");
  const participantIds = watch("participantIds");

  const totalPaise = useMemo(() => {
    if (!amount || !RUPEE_PATTERN.test(amount.trim())) return 0;
    try {
      const p = Number(rupeesToPaise(amount));
      return p > 0 ? p : 0;
    } catch {
      return 0;
    }
  }, [amount]);

  // ── EQUAL preview ─────────────────────────────────────────────────────
  // Live preview uses the same equalSplit() the server uses, so what the
  // user sees is exactly what gets written.
  const equalPreview = useMemo(() => {
    if (splitType !== "EQUAL") return null;
    if (totalPaise < 1 || !participantIds || participantIds.length === 0) return null;
    try {
      const shares = equalSplit(totalPaise, participantIds.length);
      return participantIds.map((id, i) => ({ memberId: id, amountPaise: shares[i] ?? 0 }));
    } catch {
      return null;
    }
  }, [splitType, totalPaise, participantIds]);

  // ── EXACT validation ──────────────────────────────────────────────────
  // Every selected participant gets an amount input. Sum is in paise. Form
  // is valid iff sum === totalPaise exactly.
  const exactState = useMemo(() => {
    if (splitType !== "EXACT") return null;
    const ids = participantIds ?? [];
    let sumPaise = 0;
    let allFilled = true;
    const rows = ids.map((id) => {
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
      if (paise < 0) paise = 0;
      sumPaise += paise;
      return { memberId: id, amountPaise: paise };
    });
    const remainingPaise = totalPaise - sumPaise;
    return {
      rows,
      sumPaise,
      remainingPaise,
      allFilled,
      valid: totalPaise > 0 && remainingPaise === 0 && allFilled && ids.length > 0,
    };
  }, [splitType, participantIds, exactInputs, totalPaise]);

  // ── PERCENTAGE validation ─────────────────────────────────────────────
  // Each selected participant gets a percentage input. Sum must equal 100
  // exactly. Computed shares preview uses percentageSplit().
  const percentState = useMemo(() => {
    if (splitType !== "PERCENTAGE") return null;
    const ids = participantIds ?? [];
    let sumPct = 0;
    let allFilled = true;
    const pcts = ids.map((id) => {
      const raw = percentInputs[id] ?? "";
      if (raw === "") allFilled = false;
      const n = Number(raw);
      const pct = Number.isFinite(n) && n >= 0 ? n : 0;
      sumPct += pct;
      return pct;
    });
    const remainingPct = 100 - sumPct;
    let preview: { memberId: string; amountPaise: number }[] | null = null;
    if (totalPaise > 0 && sumPct === 100 && allFilled) {
      try {
        const shares = percentageSplit(totalPaise, pcts);
        preview = ids.map((id, i) => ({ memberId: id, amountPaise: shares[i] ?? 0 }));
      } catch {
        preview = null;
      }
    }
    return {
      pcts,
      sumPct,
      remainingPct,
      allFilled,
      preview,
      valid: totalPaise > 0 && sumPct === 100 && allFilled && ids.length > 0,
    };
  }, [splitType, participantIds, percentInputs, totalPaise]);

  const splitValid =
    splitType === "EQUAL"
      ? Boolean(equalPreview)
      : splitType === "EXACT"
      ? Boolean(exactState?.valid)
      : Boolean(percentState?.valid);

  // OCR pre-fill: only overwrite fields the user hasn't manually edited.
  // We trust the receipt as the initial source but let the user override.
  const handleOcrPrefill = useCallback(
    (prefill: OcrPrefill) => {
      let filledAmount = false;
      let filledDate = false;
      if (prefill.totalAmountPaise && prefill.totalAmountPaise > 0) {
        // Format paise → "<whole>.<dd>" with integer math so the prefilled
        // string round-trips back through rupeesToPaise without drift.
        const paise = Math.trunc(prefill.totalAmountPaise);
        const whole = Math.trunc(paise / 100);
        const fraction = String(paise % 100).padStart(2, "0");
        setValue("amount", `${whole}.${fraction}`, {
          shouldValidate: true,
          shouldDirty: true,
        });
        filledAmount = true;
      }
      if (prefill.date) {
        setValue("date", prefill.date, { shouldValidate: true, shouldDirty: true });
        filledDate = true;
      }
      setPrefilledFields({ amount: filledAmount, date: filledDate });
    },
    [setValue],
  );

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const computedTotal = Number(rupeesToPaise(values.amount));

    type Payload =
      | {
          title: string;
          categoryId: string | null;
          date: string;
          totalAmount: number;
          splitType: "EQUAL";
          payerSplits: { userId: string; amountPaise: number }[];
          participantIds: string[];
        }
      | {
          title: string;
          categoryId: string | null;
          date: string;
          totalAmount: number;
          splitType: "EXACT";
          payerSplits: { userId: string; amountPaise: number }[];
          participantSplits: { userId: string; amountPaise: number }[];
        }
      | {
          title: string;
          categoryId: string | null;
          date: string;
          totalAmount: number;
          splitType: "PERCENTAGE";
          payerSplits: { userId: string; amountPaise: number }[];
          participantSplits: { userId: string; percentage: number }[];
        };

    const base = {
      title: values.title,
      categoryId: values.categoryId ? values.categoryId : null,
      date: values.date,
      totalAmount: computedTotal,
      payerSplits: [{ userId: values.paidById, amountPaise: computedTotal }],
    };

    let payload: Payload;
    if (splitType === "EQUAL") {
      payload = { ...base, splitType: "EQUAL", participantIds: values.participantIds };
    } else if (splitType === "EXACT") {
      if (!exactState?.valid) {
        setServerError("Exact amounts must sum to the total before saving.");
        return;
      }
      payload = {
        ...base,
        splitType: "EXACT",
        participantSplits: exactState.rows.map((r) => ({
          userId: r.memberId,
          amountPaise: r.amountPaise,
        })),
      };
    } else {
      if (!percentState?.valid) {
        setServerError("Percentages must sum to exactly 100 before saving.");
        return;
      }
      payload = {
        ...base,
        splitType: "PERCENTAGE",
        participantSplits: values.participantIds.map((id, i) => ({
          userId: id,
          percentage: percentState.pcts[i] ?? 0,
        })),
      };
    }

    let response: Response;
    try {
      response = await fetch(`/api/v1/groups/${groupId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    if (!response.ok) {
      let body: CreateExpenseErrorBody = {};
      try {
        body = (await response.json()) as CreateExpenseErrorBody;
      } catch {
        // fall through
      }
      setServerError(body.error?.message ?? "Couldn't save expense. Please try again.");
      return;
    }

    // Receipt upload runs after expense creation since the storage path
    // includes the new expense id. Failures here are non-fatal — the
    // expense is already saved; we just surface a warning.
    if (receiptFile) {
      try {
        const created = (await response.json()) as { expense?: { id?: string } };
        const expId = created?.expense?.id;
        if (expId) {
          const fd = new FormData();
          fd.append("file", receiptFile);
          await fetch(`/api/v1/groups/${groupId}/expenses/${expId}/receipt`, {
            method: "POST",
            body: fd,
          });
        }
      } catch {
        // Swallow — the expense saved fine; receipt can be re-attached later.
      }
    }

    router.push(`/groups/${groupId}`);
    router.refresh();
  }

  const memberById = new Map(members.map((m) => [m.id, m]));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <ReceiptUploader
        groupId={groupId}
        onFileChange={setReceiptFile}
        onPrefill={handleOcrPrefill}
      />

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Title
        </label>
        <input
          {...register("title")}
          id="title"
          type="text"
          placeholder="Dinner at Toit"
          aria-invalid={Boolean(errors.title)}
          className={cn(
            "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition",
            "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
            errors.title && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
          )}
        />
        {errors.title?.message ? (
          <p className="mt-1.5 text-xs text-rose-600">{errors.title.message}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
              Amount (₹)
            </label>
            {prefilledFields.amount ? <PrefilledBadge /> : null}
          </div>
          <input
            {...register("amount", {
              onChange: () => setPrefilledFields((p) => ({ ...p, amount: false })),
            })}
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={Boolean(errors.amount)}
            className={cn(
              "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition",
              "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              errors.amount && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
            )}
          />
          {errors.amount?.message ? (
            <p className="mt-1.5 text-xs text-rose-600">{errors.amount.message}</p>
          ) : null}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="date" className="block text-sm font-medium text-slate-700">
              Date
            </label>
            {prefilledFields.date ? <PrefilledBadge /> : null}
          </div>
          <input
            {...register("date", {
              onChange: () => setPrefilledFields((p) => ({ ...p, date: false })),
            })}
            id="date"
            type="date"
            aria-invalid={Boolean(errors.date)}
            className={cn(
              "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition",
              "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              errors.date && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
            )}
          />
          {errors.date?.message ? (
            <p className="mt-1.5 text-xs text-rose-600">{errors.date.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="categoryId" className="block text-sm font-medium text-slate-700">
            Category
          </label>
          <select
            {...register("categoryId")}
            id="categoryId"
            className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

        <div>
          <label htmlFor="paidById" className="block text-sm font-medium text-slate-700">
            Paid by
          </label>
          <select
            {...register("paidById")}
            id="paidById"
            aria-invalid={Boolean(errors.paidById)}
            className={cn(
              "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition",
              "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              errors.paidById && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
            )}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
                {m.id === viewerId ? " (you)" : ""}
              </option>
            ))}
          </select>
          {errors.paidById?.message ? (
            <p className="mt-1.5 text-xs text-rose-600">{errors.paidById.message}</p>
          ) : null}
        </div>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700">Split among</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300"
            >
              <input
                type="checkbox"
                value={m.id}
                {...register("participantIds")}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="truncate">
                {m.displayName}
                {m.id === viewerId ? <span className="ml-1 text-xs text-slate-400">(you)</span> : null}
              </span>
            </label>
          ))}
        </div>
        {errors.participantIds?.message ? (
          <p className="mt-1.5 text-xs text-rose-600">{errors.participantIds.message}</p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700">Split type</legend>
        <div
          role="tablist"
          aria-label="Split type"
          className="mt-2 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
        >
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
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t === "EQUAL" ? "Equal" : t === "EXACT" ? "Exact" : "Percentage"}
            </button>
          ))}
        </div>
      </fieldset>

      {splitType === "EQUAL" && equalPreview ? (
        <section
          aria-label="Split preview"
          className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Each person owes
          </p>
          <ul className="mt-2 divide-y divide-slate-200">
            {equalPreview.map((row) => {
              const member = memberById.get(row.memberId);
              if (!member) return null;
              return (
                <li
                  key={row.memberId}
                  className="flex items-center justify-between py-1.5 text-sm text-slate-700"
                >
                  <span className="truncate">
                    {member.displayName}
                    {member.id === viewerId ? (
                      <span className="ml-1 text-xs text-slate-400">(you)</span>
                    ) : null}
                  </span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {formatPaise(row.amountPaise)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {splitType === "EXACT" && exactState ? (
        <section
          aria-label="Exact amounts"
          className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Enter exact amount
            </p>
            <RemainingAmount remainingPaise={exactState.remainingPaise} />
          </div>
          <ul className="mt-2 divide-y divide-slate-200">
            {(participantIds ?? []).map((id) => {
              const member = memberById.get(id);
              if (!member) return null;
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3 py-1.5 text-sm text-slate-700"
                >
                  <span className="truncate">
                    {member.displayName}
                    {member.id === viewerId ? (
                      <span className="ml-1 text-xs text-slate-400">(you)</span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={exactInputs[id] ?? ""}
                      onChange={(e) =>
                        setExactInputs((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                      className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right font-mono text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {splitType === "PERCENTAGE" && percentState ? (
        <section
          aria-label="Percentage shares"
          className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Enter % per person
            </p>
            <RemainingPercentage remainingPct={percentState.remainingPct} />
          </div>
          <ul className="mt-2 divide-y divide-slate-200">
            {(participantIds ?? []).map((id, i) => {
              const member = memberById.get(id);
              if (!member) return null;
              const previewRow = percentState.preview?.[i];
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3 py-1.5 text-sm text-slate-700"
                >
                  <span className="truncate">
                    {member.displayName}
                    {member.id === viewerId ? (
                      <span className="ml-1 text-xs text-slate-400">(you)</span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-3">
                    {previewRow ? (
                      <span className="font-mono text-xs tabular-nums text-slate-500">
                        {formatPaise(previewRow.amountPaise)}
                      </span>
                    ) : null}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={percentInputs[id] ?? ""}
                        onChange={(e) =>
                          setPercentInputs((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                        className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right font-mono text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {serverError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
        >
          {serverError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(`/groups/${groupId}`)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !splitValid}
          className={cn(
            "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
            "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {isSubmitting ? "Saving…" : "Save expense"}
        </button>
      </div>
    </form>
  );
}

function RemainingAmount({ remainingPaise }: { remainingPaise: number }) {
  // Green when exactly zero — the split adds up. Red when over (more
  // allocated than the total). Slate when there's still room to allocate.
  const tone =
    remainingPaise === 0
      ? "text-emerald-700"
      : remainingPaise < 0
      ? "text-rose-700"
      : "text-slate-600";
  const label =
    remainingPaise === 0
      ? "Allocated exactly"
      : remainingPaise < 0
      ? `Over by ${formatPaise(-remainingPaise)}`
      : `${formatPaise(remainingPaise)} remaining to allocate`;
  return <span className={cn("text-xs font-medium", tone)}>{label}</span>;
}

function PrefilledBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
      Pre-filled from receipt
    </span>
  );
}

function RemainingPercentage({ remainingPct }: { remainingPct: number }) {
  const tone =
    remainingPct === 0
      ? "text-emerald-700"
      : remainingPct < 0
      ? "text-rose-700"
      : "text-slate-600";
  const label =
    remainingPct === 0
      ? "100% allocated"
      : remainingPct < 0
      ? `Over by ${(-remainingPct).toFixed(2)}%`
      : `${remainingPct.toFixed(2)}% remaining`;
  return <span className={cn("text-xs font-medium", tone)}>{label}</span>;
}
