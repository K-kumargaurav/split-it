"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/cn";
import { fireConfetti } from "@/lib/confetti";

// Confirm / dispute buttons for an incoming pending settlement. Outgoing
// pending settlements (where the viewer is the payer) render a static
// "Awaiting confirmation" badge instead — the receiver is the only party
// allowed to act per SPEC §4.5.

interface PendingSettlementActionsProps {
  groupId: string;
  settlementId: string;
  onComplete?: () => void;
}

interface PatchErrorBody {
  error?: { code?: string; message?: string };
}

export function PendingSettlementActions({
  groupId,
  settlementId,
  onComplete,
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
      const message = body.error?.message ?? "Couldn't update settlement.";
      setError(message);
      toast.error(message);
      return;
    }

    setPending(null);
    onComplete?.();
    if (action === "confirm") {
      toast.success("Settlement confirmed");
      fireConfetti();
    } else {
      toast.success("Settlement disputed");
    }
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
            "rounded-xl border border-error/20 bg-error/5 px-3 py-1.5 text-[12px] font-medium text-error transition",
            "hover:border-error/30 hover:bg-error/10",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {pending === "dispute" ? "Disputing..." : "Dispute"}
        </button>
        <button
          type="button"
          onClick={() => send("confirm")}
          disabled={pending !== null}
          className={cn(
            "rounded-xl bg-accent px-3 py-1.5 text-[12px] font-semibold text-[#0E1116] transition",
            "hover:opacity-90",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {pending === "confirm" ? "Confirming..." : "Confirm"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-[12px] text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
