"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

interface DangerZoneProps {
  groupId: string;
  groupName: string;
}

export function DangerZone({ groupId, groupName }: DangerZoneProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmText.trim() === groupName;

  async function archive(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/groups/${groupId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(json?.error?.message ?? "Couldn't archive the group.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't archive the group.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Archived groups are hidden from your dashboard. Balances and history stay readable.
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        >
          Archive group
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Type <span className="font-semibold text-slate-900 dark:text-white">{groupName}</span> to confirm.
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={groupName}
        aria-label="Confirm group name"
        className="block w-full rounded-xl border border-rose-200 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
      />
      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={archive}
          disabled={!matches || submitting}
          className={cn(
            "inline-flex items-center justify-center rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition",
            "hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {submitting ? "Archiving…" : "Archive permanently"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirmText("");
            setError(null);
          }}
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
