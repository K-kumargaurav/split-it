"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Smartphone, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/cn";
import { formatPaise, paiseToRupees, rupeesToPaise } from "@/lib/format";
import { generateUpiLink } from "@/lib/upi";
import { AmountInput } from "@/components/ui/amount-input";
import { PremiumCard } from "@/components/ui/premium-card";
import { PremiumSelect } from "@/components/ui/premium-select";

// Mark-as-paid form. Receivers are limited to people the viewer *directly*
// owes — per SPEC §3.4 the underlying ledger is direct debts, so this is the
// truth regardless of the group's display mode. Amount defaults to the full
// debt to the selected receiver and is capped at that figure server-side as
// well (defence-in-depth — the server is the source of truth for the cap).

export interface DebtOption {
  receiverId: string;
  receiverDisplayName: string;
  receiverHandle: string;
  receiverUpiId: string | null;
  amountPaise: number;
}

const PAYMENT_METHODS: { value: "CASH" | "UPI" | "OTHER"; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "OTHER", label: "Other" },
];

interface SettlementFormProps {
  groupId: string;
  debts: DebtOption[];
  defaultReceiverId?: string;
}

interface CreateSettlementErrorBody {
  error?: { code?: string; message?: string };
}

export function SettlementForm({
  groupId,
  debts,
  defaultReceiverId,
}: SettlementFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [receiverId, setReceiverId] = useState<string>(() => {
    if (defaultReceiverId && debts.some((d) => d.receiverId === defaultReceiverId)) {
      return defaultReceiverId;
    }
    return debts[0]?.receiverId ?? "";
  });

  const selected = useMemo(
    () => debts.find((d) => d.receiverId === receiverId),
    [debts, receiverId],
  );

  const [amountRupees, setAmountRupees] = useState<string>(() =>
    selected ? paiseToRupees(selected.amountPaise).toFixed(2) : "",
  );
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "OTHER">("UPI");
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);

  function handleReceiverChange(next: string): void {
    setReceiverId(next);
    const debt = debts.find((d) => d.receiverId === next);
    if (debt) setAmountRupees(paiseToRupees(debt.amountPaise).toFixed(2));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setServerError(null);

    if (!selected) {
      setServerError("Pick someone you owe to record a payment.");
      return;
    }

    const trimmed = amountRupees.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      setServerError("Enter a valid amount (max 2 decimals).");
      return;
    }
    let totalPaise: number;
    try {
      totalPaise = Number(rupeesToPaise(trimmed));
    } catch {
      setServerError("Enter a valid amount.");
      return;
    }
    if (totalPaise <= 0) {
      setServerError("Enter an amount greater than zero.");
      return;
    }
    if (totalPaise > selected.amountPaise) {
      setServerError(
        `You only owe ${formatPaise(selected.amountPaise)} to ${selected.receiverDisplayName}.`,
      );
      return;
    }

    setSubmitting(true);
    let response: Response;
    try {
      response = await fetch(`/api/v1/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selected.receiverId,
          amountPaise: totalPaise,
          paymentMethod,
          paymentRef: paymentRef.trim() ? paymentRef.trim() : null,
        }),
      });
    } catch {
      setSubmitting(false);
      setServerError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    if (!response.ok) {
      let body: CreateSettlementErrorBody = {};
      try {
        body = (await response.json()) as CreateSettlementErrorBody;
      } catch {
        // fall through
      }
      setSubmitting(false);
      setServerError(body.error?.message ?? "Couldn't record payment. Please try again.");
      return;
    }

    setSubmitting(false);
    setPending(true);
    toast.success("Payment recorded — waiting for confirmation");
  }

  if (debts.length === 0) {
    return (
      <PremiumCard className="px-5 py-12 text-center">
        <p className="text-base font-semibold text-text-primary">
          You&apos;re all settled up
        </p>
        <p className="mt-1.5 text-sm text-text-secondary">
          You don&apos;t currently owe anyone in this group.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/groups/${groupId}`)}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-2xl border border-border-dashed px-5 text-sm font-medium text-text-primary transition hover:border-white/[0.12]"
        >
          Back to group
        </button>
      </PremiumCard>
    );
  }

  if (pending) {
    return (
      <PremiumCard className="px-5 py-10 text-center">
        <p className="text-base font-semibold text-text-primary">
          Waiting for {selected?.receiverDisplayName ?? "the receiver"} to confirm
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          We&apos;ve notified them. Your debt stays on the books until they confirm
          the payment.
        </p>
        <button
          type="button"
          onClick={() => startTransition(() => {
            router.push(`/groups/${groupId}`);
            router.refresh();
          })}
          className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-accent px-6 text-sm font-semibold text-bg transition hover:opacity-90"
        >
          Back to group
        </button>
      </PremiumCard>
    );
  }

  const showUpiBlock = paymentMethod === "UPI" && selected !== undefined;
  const upiLink =
    showUpiBlock && selected!.receiverUpiId
      ? safeBuildUpiLink({
          vpa: selected!.receiverUpiId,
          name: selected!.receiverDisplayName,
          amountPaise: safeRupeesToPaise(amountRupees),
        })
      : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Receiver selector — shown only when multiple debts */}
      {debts.length > 1 ? (
        <PremiumSelect
          label="Pay"
          value={receiverId}
          onChange={(e) => handleReceiverChange(e.target.value)}
        >
          {debts.map((d) => (
            <option key={d.receiverId} value={d.receiverId}>
              {d.receiverDisplayName} — you owe {formatPaise(d.amountPaise)}
            </option>
          ))}
        </PremiumSelect>
      ) : null}

      {/* Debt summary card */}
      {selected ? (
        <PremiumCard className="px-5 py-6 text-center">
          <p className="text-lg font-semibold text-text-primary">
            You owe {selected.receiverDisplayName}
          </p>
          <p
            className="mt-2 text-[36px] font-bold tabular-nums leading-none text-error"
          >
            {formatPaise(selected.amountPaise)}
          </p>
          <p className="mt-2 text-[13px] text-text-secondary">
            from {debts.length === 1 ? "this group" : "shared expenses"}
          </p>
        </PremiumCard>
      ) : null}

      {/* Amount to pay */}
      <PremiumCard className="p-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
          Amount to pay
        </p>
        <div className="py-4">
          <AmountInput
            id="amount"
            value={amountRupees}
            onChange={setAmountRupees}
          />
        </div>
        <p className="text-center text-[12px] text-text-secondary">
          Partial payment allowed
        </p>
      </PremiumCard>

      {/* Payment method */}
      <PremiumCard className="p-5">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
          Payment method
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => {
            const isActive = paymentMethod === m.value;
            return (
              <label
                key={m.value}
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded-2xl border px-3 py-3 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "border-accent bg-[rgba(0,200,150,0.05)] text-accent"
                    : "border-surface-hover bg-[rgba(255,255,255,0.02)] text-text-secondary",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.value}
                  checked={isActive}
                  onChange={() => setPaymentMethod(m.value)}
                  className="sr-only"
                />
                {m.label}
              </label>
            );
          })}
        </div>
      </PremiumCard>

      {/* UPI block */}
      {showUpiBlock && upiLink ? (
        <PremiumCard className="p-5 space-y-4">
          {/* Copyable UPI ID pill */}
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-text-secondary">Paying to</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(selected!.receiverUpiId ?? "");
                toast.success("UPI ID copied");
              }}
              className="flex items-center gap-1.5 rounded-full border border-border-dashed px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:text-text-primary"
            >
              <span className="font-mono">{selected!.receiverUpiId}</span>
              <Copy size={11} />
            </button>
          </div>

          {/* Pay via UPI button */}
          <a
            href={upiLink}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-bg text-sm font-semibold transition hover:opacity-90"
          >
            <Smartphone size={18} />
            Pay via UPI
          </a>

          {/* Desktop fallback placeholder */}
          <div className="hidden sm:block">
            <p className="text-center text-[11px] text-text-secondary">
              On desktop? Scan with your UPI app:
            </p>
            <div
              className="mx-auto mt-2 flex h-32 w-32 items-center justify-center rounded-xl border-2 border-dashed border-border-dashed text-[10px] uppercase tracking-wider text-text-secondary"
              aria-hidden="true"
            >
              QR placeholder
            </div>
          </div>
        </PremiumCard>
      ) : null}

      {showUpiBlock && !upiLink ? (
        <div
          className="rounded-2xl border border-[rgba(255,176,32,0.2)] bg-[rgba(255,176,32,0.06)] text-warning px-4 py-3 text-sm"
        >
          {selected!.receiverDisplayName} hasn&apos;t added a UPI ID yet — pay them
          another way and record it here.
        </div>
      ) : null}

      {/* Transaction reference */}
      {paymentMethod !== "CASH" ? (
        <PremiumCard className="p-5">
          <label
            htmlFor="paymentRef"
            className="mb-1.5 block text-[13px] text-text-secondary"
          >
            Transaction reference{" "}
            <span className="text-[12px] opacity-60">(optional)</span>
          </label>
          <input
            id="paymentRef"
            type="text"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="UPI reference / transaction id"
            className="block h-12 w-full rounded-2xl border border-surface-hover bg-[rgba(255,255,255,0.03)] px-4 text-sm text-text-primary outline-none transition placeholder:text-text-secondary focus:border-accent"
          />
        </PremiumCard>
      ) : null}

      {/* Server error */}
      {serverError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-2xl border border-[rgba(255,71,87,0.2)] bg-[rgba(255,71,87,0.08)] px-4 py-3 text-sm text-error"
        >
          {serverError}
        </div>
      ) : null}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className={cn(
          "flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold transition",
          "bg-accent text-bg hover:opacity-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          "active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {submitting ? "Recording…" : "Mark as Paid"}
      </button>
    </form>
  );
}

// Best-effort string→paise for the live UPI link preview. Returns 0 for any
// not-yet-valid input so the link still renders (the user is mid-typing).
function safeRupeesToPaise(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 0;
  try {
    return Number(rupeesToPaise(trimmed));
  } catch {
    return 0;
  }
}

// Wrap generateUpiLink so a mid-typing amount or a malformed stored VPA never
// throws past React (the canonical generator throws on invalid input). Callers
// only render the link when this returns non-null.
function safeBuildUpiLink(args: {
  vpa: string;
  name: string;
  amountPaise: number;
}): string | null {
  if (args.amountPaise <= 0) return null;
  try {
    return generateUpiLink({
      vpa: args.vpa,
      name: args.name,
      amount: BigInt(args.amountPaise),
      note: "SplitEasy settlement",
    });
  } catch {
    return null;
  }
}
