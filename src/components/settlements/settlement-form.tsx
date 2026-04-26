"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatPaise, paiseToRupees, rupeesToPaise } from "@/lib/format";

// Mark-as-paid form. Receivers are limited to people the viewer *directly*
// owes — per SPEC §3.4 the underlying ledger is direct debts, so this is the
// truth regardless of the group's display mode. Amount defaults to the full
// debt to the selected receiver and is capped at that figure server-side as
// well (defence-in-depth — the server is the source of truth for the cap).

export interface DebtOption {
  receiverId: string;
  receiverDisplayName: string;
  receiverHandle: string;
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

    const rupeeNum = Number(amountRupees);
    if (!Number.isFinite(rupeeNum) || rupeeNum <= 0) {
      setServerError("Enter an amount greater than zero.");
      return;
    }
    const totalPaise = rupeesToPaise(rupeeNum);
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
  }

  if (debts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
        <p className="text-sm font-medium text-slate-700">You&apos;re all settled up</p>
        <p className="mt-1 text-sm text-slate-500">
          You don&apos;t currently owe anyone in this group.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/groups/${groupId}`)}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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

  const upiLink = paymentMethod === "UPI" && selected
    ? buildUpiLink({
        handle: selected.receiverHandle,
        displayName: selected.receiverDisplayName,
        amountPaise: rupeesToPaise(Number(amountRupees) || 0),
      })
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="receiver" className="block text-sm font-medium text-slate-700">
          Pay
        </label>
        <select
          id="receiver"
          value={receiverId}
          onChange={(e) => handleReceiverChange(e.target.value)}
          className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {debts.map((d) => (
            <option key={d.receiverId} value={d.receiverId}>
              {d.receiverDisplayName} — you owe {formatPaise(d.amountPaise)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
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
          className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {selected ? (
          <p className="mt-1.5 text-xs text-slate-500">
            Max {formatPaise(selected.amountPaise)} (your current debt).
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700">Payment method</legend>
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
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
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

      {upiLink ? (
        <a
          href={upiLink}
          className="block rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
        >
          Open in UPI app to pay {selected?.receiverDisplayName}
        </a>
      ) : null}

      {paymentMethod !== "CASH" ? (
        <div>
          <label htmlFor="paymentRef" className="block text-sm font-medium text-slate-700">
            Transaction reference{" "}
            <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="paymentRef"
            type="text"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="UPI reference / transaction id"
            className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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

// UPI deep link per NPCI spec: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR.
// We don't store VPAs yet, so we synthesise one from the receiver's handle —
// the user will edit it inside the UPI app before sending. The alternative
// (hiding the button) is worse UX since most receivers do have UPI; leaving
// the link clickable with a placeholder VPA is intentional.
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
