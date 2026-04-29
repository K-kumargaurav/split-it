"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

// Vote / cancel / propose-delete buttons for the expense detail page.
// All paths POST/DELETE the proposal API and refresh the server tree on
// success. Errors come back in the standard SPEC §6.0 envelope.

interface ProposalActionsProps {
  groupId: string;
  expenseId: string;
  proposalId: string | null;
  isProposer: boolean;
  hasVoted: boolean;
  votingClosed: boolean;
}

export function ProposalActions({
  groupId,
  expenseId,
  proposalId,
  isProposer,
  hasVoted,
  votingClosed,
}: ProposalActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!proposalId) return null;

  async function vote(choice: "APPROVE" | "REJECT") {
    setBusy(choice === "APPROVE" ? "approve" : "reject");
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/groups/${groupId}/expenses/${expenseId}/proposals/${proposalId}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote: choice }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(body.error?.message ?? "Couldn't record your vote.");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/groups/${groupId}/expenses/${expenseId}/proposals/${proposalId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(body.error?.message ?? "Couldn't cancel the proposal.");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {!isProposer && !hasVoted && !votingClosed ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => vote("APPROVE")}
            disabled={busy !== null}
            className={cn(
              "rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition",
              "hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {busy === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => vote("REJECT")}
            disabled={busy !== null}
            className={cn(
              "rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 shadow-sm transition",
              "hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      ) : null}

      {isProposer && !votingClosed ? (
        <button
          type="button"
          onClick={cancel}
          disabled={busy !== null}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "cancel" ? "Cancelling…" : "Cancel proposal"}
        </button>
      ) : null}

      {hasVoted && !isProposer ? (
        <p className="text-xs text-slate-500">You've already voted.</p>
      ) : null}

      {error ? (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
