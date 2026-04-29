"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Triggers DELETE on the expense. Server decides whether it's an immediate
// soft delete (own expense) or opens a deletion proposal (others'). The UX
// label adapts so the user knows whether they're voting or just deleting.

interface DeleteExpenseButtonProps {
  groupId: string;
  expenseId: string;
  isOwn: boolean;
}

export function DeleteExpenseButton({
  groupId,
  expenseId,
  isOwn,
}: DeleteExpenseButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    const confirmMsg = isOwn
      ? "Delete this expense? This cannot be undone."
      : "Propose deleting this expense? Other members will need to vote.";
    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/groups/${groupId}/expenses/${expenseId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(body.error?.message ?? "Couldn't delete the expense.");
      } else if (isOwn) {
        router.push(`/groups/${groupId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy
          ? isOwn
            ? "Deleting…"
            : "Submitting…"
          : isOwn
          ? "Delete"
          : "Propose deletion"}
      </button>
      {error ? (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
