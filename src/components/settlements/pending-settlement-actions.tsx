"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

// Confirm / dispute buttons for an incoming pending settlement. Outgoing
// pending settlements (where the viewer is the payer) render a static
// "Awaiting confirmation" badge instead — the receiver is the only party
// allowed to act per SPEC §4.5.

interface PendingSettlementActionsProps {
  groupId: string;
  settlementId: string;
}

interface PatchErrorBody {
  error?: { code?: string; message?: string };
}

export function PendingSettlementActions({
  groupId,
  settlementId,
}: PendingSettlementActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"confirm" | "dispute" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "confirm" | "dispute"): Promise<void> {
    setError(null);
    setPending(action);
    let response: Response;
    try {
      response = await fetch(
        `/api/v1/groups/${groupId}/settlements/${settlementId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
    } catch {
      setPending(null);
      setError("Couldn't reach the server. Try again.");
      return;
    }

    if (!response.ok) {
      let body: PatchErrorBody = {};
      try {
        body = (await response.json()) as PatchErrorBody;
      } catch {
        // fall through
      }
      setPending(null);
      setError(body.error?.message ?? "Couldn't update settlement.");
      return;
    }

    setPending(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => send("dispute")}
          disabled={pending !== null}
          className={cn(
            "rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {pending === "dispute" ? "Disputing…" : "Dispute"}
        </button>
        <button
          type="button"
          onClick={() => send("confirm")}
          disabled={pending !== null}
          className={cn(
            "rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {pending === "confirm" ? "Confirming…" : "Confirm"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
