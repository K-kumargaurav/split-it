"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";

interface GuestDebtActionsProps {
  token: string;
  receiverId: string;
  receiverDisplayName: string;
  receiverHandle: string;
  amountPaise: number;
}

// Per-debt UI: a UPI deep link (best-effort, see buildUpiLink below) and a
// "Mark as Paid" button. Once marked, the row swaps to a pending-confirmation
// banner — the receiver still has to confirm before balances update.
export function GuestDebtActions({
  token,
  receiverId,
  receiverDisplayName,
  receiverHandle,
  amountPaise,
}: GuestDebtActionsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upiLink = buildUpiLink({
    handle: receiverHandle,
    displayName: receiverDisplayName,
    amountPaise,
  });

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
    <div className="space-y-2">
      <a
        href={upiLink}
        className="flex w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
      >
        Open in UPI app
      </a>
      <button
        type="button"
        onClick={markPaid}
        disabled={submitting}
        className={cn(
          "block w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition",
          "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
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

// UPI deep link per NPCI spec: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR.
// We synthesise the VPA from the receiver's handle since SplitEasy doesn't
// store actual UPI VPAs yet; the user edits it inside their UPI app before
// sending. Hiding the link entirely is worse UX since most receivers have UPI.
function buildUpiLink(args: {
  handle: string;
  displayName: string;
  amountPaise: number;
}): string {
  const vpa = `${args.handle}@upi`;
  const params = new URLSearchParams({
    pa: vpa,
    pn: args.displayName,
    am: (args.amountPaise / 100).toFixed(2),
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}
