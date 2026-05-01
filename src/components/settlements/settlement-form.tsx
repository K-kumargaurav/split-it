"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/cn";
import { formatPaise, paiseToRupees, rupeesToPaise } from "@/lib/format";
import { generateUpiLink } from "@/lib/upi";

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
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-5 py-10 text-center">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">You&apos;re all settled up</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          You don&apos;t currently owe anyone in this group.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/groups/${groupId}`)}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Back to group
        </button>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-center">
        <p className="text-sm font-semibold text-amber-900">
          Waiting for {selected?.receiverDisplayName ?? "the receiver"} to confirm
        </p>
        <p className="mt-1 text-sm text-amber-800">
          We&apos;ve notified them. Your debt stays on the books until they confirm
          the payment.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.push(`/groups/${groupId}`);
              router.refresh();
            }}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            Back to group
          </button>
        </div>
      </div>
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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="receiver" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Pay
        </label>
        <select
          id="receiver"
          value={receiverId}
          onChange={(e) => handleReceiverChange(e.target.value)}
          className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {debts.map((d) => (
            <option key={d.receiverId} value={d.receiverId}>
              {d.receiverDisplayName} — you owe {formatPaise(d.amountPaise)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Amount (₹)
        </label>
        <input
          id="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          value={amountRupees}
          onChange={(e) => setAmountRupees(e.target.value)}
          className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {selected ? (
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Max {formatPaise(selected.amountPaise)} (your current debt).
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200">Payment method</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => {
            const isActive = paymentMethod === m.value;
            return (
              <label
                key={m.value}
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600",
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
      </fieldset>

      {showUpiBlock && upiLink ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <a
            href={upiLink}
            className="block rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            Pay via UPI
          </a>
          <p className="mt-2 text-center text-xs text-indigo-900/80">
            Pay to <span className="font-mono font-semibold">{selected!.receiverUpiId}</span>
          </p>
          {/* Desktop fallback: the upi:// scheme has no handler on most desktops,
              so surface the raw deep-link string for copy/QR-scan workflows. A
              real QR renderer ships in a follow-up — this placeholder reserves
              the slot in the layout. */}
          <div className="mt-3 hidden sm:block">
            <p className="text-xs font-medium text-indigo-900/80">
              On desktop? Scan this with your UPI app:
            </p>
            <div
              aria-hidden="true"
              className="mt-2 flex h-32 w-32 items-center justify-center rounded-lg border-2 border-dashed border-indigo-300 bg-white text-[10px] uppercase tracking-wider text-indigo-400"
            >
              QR placeholder
            </div>
            <p className="mt-2 break-all font-mono text-[10px] text-indigo-900/70">
              {upiLink}
            </p>
          </div>
        </div>
      ) : null}
      {showUpiBlock && !upiLink ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {selected!.receiverDisplayName} hasn&apos;t added a UPI ID yet — pay them
          another way and record it here.
        </p>
      ) : null}

      {paymentMethod !== "CASH" ? (
        <div>
          <label htmlFor="paymentRef" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Transaction reference{" "}
            <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="paymentRef"
            type="text"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="UPI reference / transaction id"
            className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
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
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
            "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {submitting ? "Recording…" : "Mark as paid"}
        </button>
      </div>
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
