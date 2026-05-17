"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/cn";
import { formatPaise, rupeesToPaise } from "@/lib/format";
import { equalSplit, percentageSplit } from "@/lib/split";
import dynamic from "next/dynamic";
import type { OcrPrefill } from "@/components/expenses/receipt-uploader";

const ReceiptUploader = dynamic(
  () => import("@/components/expenses/receipt-uploader").then((mod) => mod.ReceiptUploader),
  { ssr: false },
);
import { AmountInput } from "@/components/ui/amount-input";
import { MemberSelector, type SelectorMember } from "@/components/ui/member-selector";
import { PremiumCard } from "@/components/ui/premium-card";
import { PremiumInput } from "@/components/ui/premium-input";
import { PremiumSelect } from "@/components/ui/premium-select";

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

// Ghost members surface in the same selectors as real members per SPEC §4.6,
// but they're stored on a different table — distinguishing the option in the
// UI lets the user know they're including a guest in the split.
interface GhostMemberOption {
  id: string;
  displayName: string;
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
  ghostMembers?: GhostMemberOption[];
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

export function ExpenseForm({
  groupId,
  viewerId,
  members,
  ghostMembers = [],
  categories,
}: ExpenseFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
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
  const paidById = watch("paidById");
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

    toast.success("Expense added");
    startTransition(() => {
      router.push(`/groups/${groupId}`);
      router.refresh();
    });
  }

  const memberById = new Map<
    string,
    { id: string; displayName: string; isGhost: boolean }
  >([
    ...members.map((m) => [m.id, { id: m.id, displayName: m.displayName, isGhost: false }] as const),
    ...ghostMembers.map((g) => [g.id, { id: g.id, displayName: g.displayName, isGhost: true }] as const),
  ]);

  const allMembersForSelector: SelectorMember[] = useMemo(
    () => [
      ...members.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        handle: m.handle,
        isGhost: false,
      })),
      ...ghostMembers.map((g) => ({
        id: g.id,
        displayName: g.displayName,
        handle: "",
        isGhost: true,
      })),
    ],
    [members, ghostMembers],
  );

  const perPersonPaise =
    splitType === "EQUAL" && equalPreview && equalPreview.length > 0
      ? (equalPreview[0]?.amountPaise ?? null)
      : null;

  const submitLabel = useMemo(() => {
    if (isSubmitting) return "Saving…";
    const count = participantIds?.length ?? 0;
    if (totalPaise > 0 && count > 0) {
      return `Save ${formatPaise(totalPaise, { hidePaiseIfZero: true })} · Split ${count} ${count === 1 ? "way" : "ways"}`;
    }
    return "Save Expense";
  }, [isSubmitting, totalPaise, participantIds]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Receipt upload zone */}
      <ReceiptUploader
        groupId={groupId}
        onFileChange={setReceiptFile}
        onPrefill={handleOcrPrefill}
      />

      {/* Amount — most prominent */}
      <div className="py-6 text-center">
        <AmountInput
          id="amount"
          value={amount}
          onChange={(v) => {
            void setValue("amount", v, { shouldValidate: true, shouldDirty: true });
            setPrefilledFields((p) => ({ ...p, amount: false }));
          }}
          error={errors.amount?.message}
        />
        {perPersonPaise !== null ? (
          <p className="mt-3 text-[14px] text-text-secondary">
            = {formatPaise(perPersonPaise, { hidePaiseIfZero: true })} per person
          </p>
        ) : null}
      </div>

      {/* Section 1 — Details */}
      <PremiumCard className="p-5">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
          Details
        </p>
        <div className="space-y-4">
          <PremiumInput
            label="Title"
            placeholder="Dinner at Toit"
            aria-invalid={Boolean(errors.title)}
            error={errors.title?.message}
            {...register("title")}
          />
          <PremiumInput
            label="Date"
            type="date"
            aria-invalid={Boolean(errors.date)}
            error={errors.date?.message}
            {...(prefilledFields.date
              ? {
                  rightIcon: (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-accent-muted text-accent"
                    >
                      OCR
                    </span>
                  ),
                }
              : {})}
            {...register("date", {
              onChange: () => setPrefilledFields((p) => ({ ...p, date: false })),
            })}
          />
          <PremiumSelect
            label="Category"
            {...register("categoryId")}
          >
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? `${c.emoji} ` : ""}
                {c.name}
              </option>
            ))}
          </PremiumSelect>
        </div>
      </PremiumCard>

      {/* Section 2 — Paid by */}
      <PremiumCard className="p-5">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
          Paid by
        </p>
        <MemberSelector
          members={allMembersForSelector}
          selected={paidById ?? ""}
          onToggle={(id) => setValue("paidById", id, { shouldValidate: true })}
          mode="single"
          error={errors.paidById?.message}
        />
      </PremiumCard>

      {/* Section 3 — Split among */}
      <PremiumCard className="p-5">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
          Split among
        </p>
        <MemberSelector
          members={allMembersForSelector}
          selected={participantIds ?? []}
          onToggle={(id) => {
            const current = participantIds ?? [];
            const next = current.includes(id)
              ? current.filter((x) => x !== id)
              : [...current, id];
            setValue("participantIds", next, { shouldValidate: true, shouldDirty: true });
          }}
          mode="multi"
          error={errors.participantIds?.message}
        />

        {/* Split type toggle — same tab style as auth pages */}
        <div
          role="tablist"
          aria-label="Split type"
          className="mt-5 grid grid-cols-3 gap-0.5 sm:gap-1 rounded-2xl bg-card p-1"
        >
          {(["EQUAL", "EXACT", "PERCENTAGE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={splitType === t}
              onClick={() => setSplitType(t)}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                splitType === t
                  ? "bg-bg text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {t === "EQUAL" ? "Equal" : t === "EXACT" ? "Exact" : "Percentage"}
            </button>
          ))}
        </div>

        {/* Live split preview */}
        {splitType === "EQUAL" && equalPreview ? (
          <ul
            aria-label="Split preview"
            className="mt-4 divide-y border-border-subtle"
          >
            {equalPreview.map((row) => {
              const member = memberById.get(row.memberId);
              if (!member) return null;
              return (
                <li
                  key={row.memberId}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <MemberAvatar name={member.displayName} />
                    <span className="text-sm text-text-primary">
                      {member.displayName}
                      {member.id === viewerId ? (
                        <span className="ml-1 text-xs text-text-secondary">(you)</span>
                      ) : null}
                    </span>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-text-primary">
                    {formatPaise(row.amountPaise)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {splitType === "EXACT" && exactState ? (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
                Enter exact amount
              </span>
              <RemainingAmount remainingPaise={exactState.remainingPaise} />
            </div>
            <ul
              className="divide-y border-border-subtle"
            >
              {(participantIds ?? []).map((id) => {
                const member = memberById.get(id);
                if (!member) return null;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <MemberAvatar name={member.displayName} />
                      <span className="text-sm text-text-primary">
                        {member.displayName}
                        {member.id === viewerId ? (
                          <span className="ml-1 text-xs text-text-secondary">(you)</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-text-secondary">₹</span>
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
                        className="w-24 sm:w-28 rounded-xl border px-2 py-1 text-right font-mono text-sm text-text-primary outline-none focus:border-accent bg-surface-subtle border-border-dashed"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {splitType === "PERCENTAGE" && percentState ? (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
                Enter % per person
              </span>
              <RemainingPercentage remainingPct={percentState.remainingPct} />
            </div>
            <ul
              className="divide-y border-border-subtle"
            >
              {(participantIds ?? []).map((id, i) => {
                const member = memberById.get(id);
                if (!member) return null;
                const previewRow = percentState.preview?.[i];
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <MemberAvatar name={member.displayName} />
                      <span className="text-sm text-text-primary">
                        {member.displayName}
                        {member.id === viewerId ? (
                          <span className="ml-1 text-xs text-text-secondary">(you)</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {previewRow ? (
                        <span className="font-mono text-xs tabular-nums text-text-secondary">
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
                          className="w-16 sm:w-20 rounded-xl border px-2 py-1 text-right font-mono text-sm text-text-primary outline-none focus:border-accent bg-surface-subtle border-border-dashed"
                        />
                        <span className="text-xs text-text-secondary">%</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </PremiumCard>

      {/* Server error */}
      {serverError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-2xl border px-4 py-3 text-sm text-error border-error/20 bg-error/[0.08]"
        >
          {serverError}
        </div>
      ) : null}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || !splitValid}
        className={cn(
          "flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold transition",
          "bg-accent text-bg hover:opacity-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          "active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {submitLabel}
      </button>
    </form>
  );
}

function MemberAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-semibold text-text-secondary bg-surface-hover"
    >
      {initials}
    </span>
  );
}

function RemainingAmount({ remainingPaise }: { remainingPaise: number }) {
  const color =
    remainingPaise === 0
      ? "#00C896"
      : remainingPaise < 0
      ? "#FF4757"
      : "#8B93A7";
  const label =
    remainingPaise === 0
      ? "Allocated exactly"
      : remainingPaise < 0
      ? `Over by ${formatPaise(-remainingPaise)}`
      : `${formatPaise(remainingPaise)} remaining`;
  return (
    <span className="text-xs font-medium" style={{ color }}>
      {label}
    </span>
  );
}

function RemainingPercentage({ remainingPct }: { remainingPct: number }) {
  const color =
    remainingPct === 0
      ? "#00C896"
      : remainingPct < 0
      ? "#FF4757"
      : "#8B93A7";
  const label =
    remainingPct === 0
      ? "100% allocated"
      : remainingPct < 0
      ? `Over by ${(-remainingPct).toFixed(2)}%`
      : `${remainingPct.toFixed(2)}% remaining`;
  return (
    <span className="text-xs font-medium" style={{ color }}>
      {label}
    </span>
  );
}
