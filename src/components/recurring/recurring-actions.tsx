"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

interface RecurringActionsProps {
  groupId: string;
  templateId: string;
  isActive: boolean;
}

export function RecurringActions({
  groupId,
  templateId,
  isActive,
}: RecurringActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"toggle" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(): Promise<void> {
    setBusy("toggle");
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/groups/${groupId}/recurring/${templateId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !isActive }),
        },
      );
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(json?.error?.message ?? "Couldn't update.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't update.");
    } finally {
      setBusy(null);
    }
  }

  async function destroy(): Promise<void> {
    if (!window.confirm("Delete this recurring expense? Past entries stay intact.")) {
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/groups/${groupId}/recurring/${templateId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(json?.error?.message ?? "Couldn't delete.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't delete.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy !== null}
        aria-pressed={!isActive}
        className={cn(
          "rounded-lg border px-2.5 py-1 text-xs font-medium transition",
          isActive
            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {busy === "toggle" ? "…" : isActive ? "Pause" : "Resume"}
      </button>
      <button
        type="button"
        onClick={destroy}
        disabled={busy !== null}
        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy === "delete" ? "…" : "Delete"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
