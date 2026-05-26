"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { UpiPaymentBlock } from "@/components/settlements/upi-payment-block";

interface GuestDebtActionsProps {
  token: string;
  receiverId: string;
  receiverDisplayName: string;
  receiverUpiId: string | null;
  receiverPhone: string | null;
  amountPaise: number;
}

// Per-debt UI: a UPI deep link (only when the receiver has a stored VPA — see
// SPEC §4.7) and a "Mark as Paid" button. The UPI button is the primary CTA
// for guests on mobile because it gets them straight into their UPI app.
// Once "Mark as Paid" is pressed the row swaps to a pending banner — the
// receiver still has to confirm before balances update.
export function GuestDebtActions({
  token,
  receiverId,
  receiverDisplayName,
  receiverUpiId,
  receiverPhone,
  amountPaise,
}: GuestDebtActionsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markPaid(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/guest/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId,
          amountPaise,
          paymentMethod: "UPI",
        }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(json?.error?.message ?? "Couldn't record the payment.");
        return;
      }
      setPending(true);
      router.refresh();
    } catch {
      setError("Couldn't record the payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pending) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Waiting for {receiverDisplayName} to confirm your payment of{" "}
        <span className="font-semibold">{formatPaise(amountPaise)}</span>.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <UpiPaymentBlock
        vpa={receiverUpiId}
        displayName={receiverDisplayName}
        amountPaise={amountPaise}
        phone={receiverPhone}
      />
      <button
        type="button"
        onClick={markPaid}
        disabled={submitting}
        className={cn(
          "block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition",
          "hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {submitting ? "Recording…" : "Mark as paid"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

