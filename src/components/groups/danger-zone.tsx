"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

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
      <div className="space-y-3">
        <p className="text-[14px] text-text-secondary leading-relaxed">
          Archived groups are hidden from your dashboard. All balances and history remain readable.
        </p>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setConfirming(true)}
          className={cn(
            "inline-flex h-10 items-center rounded-2xl border border-error/40 px-5 text-sm font-semibold text-error transition",
            "hover:border-error/60 hover:bg-error/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40",
          )}
        >
          Archive group
        </motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-text-secondary">
        Type{" "}
        <span className="font-semibold text-text-primary">{groupName}</span>{" "}
        to confirm.
      </p>

      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={groupName}
        aria-label="Confirm group name"
        className={cn(
          "block w-full rounded-2xl border bg-card px-4 py-3 text-sm text-text-primary transition",
          "placeholder:text-text-secondary focus:outline-none focus:ring-2",
          "border-error/20 focus:border-error/50 focus:ring-error/10",
        )}
      />

      {error ? (
        <p role="alert" className="text-[13px] text-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={archive}
          disabled={!matches || submitting}
          className={cn(
            "inline-flex h-10 items-center rounded-2xl bg-error px-5 text-sm font-semibold text-white transition",
            "hover:bg-error/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {submitting ? "Archiving…" : "Archive permanently"}
        </motion.button>

        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirmText("");
            setError(null);
          }}
          disabled={submitting}
          className={cn(
            "inline-flex h-10 items-center rounded-2xl border border-white/10 px-5 text-sm font-medium text-text-secondary transition",
            "hover:border-white/20 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
