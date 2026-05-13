"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Key, Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";

export function AccountSettings() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmText.trim() === "DELETE";

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/v1/users/me", { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(json?.error?.message ?? "Couldn't delete account.");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Couldn't delete account.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    const res = await fetch("/api/v1/users/me/export");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-0 divide-y divide-white/[0.04]">
      {/* Change Password */}
      <ActionRow
        icon={<Key size={16} />}
        label="Change Password"
        description="Update your account password"
        action={
          <Link
            href="/reset-password"
            className="text-[13px] text-text-secondary transition hover:text-text-primary"
          >
            Change →
          </Link>
        }
      />

      {/* Export my data */}
      <ActionRow
        icon={<Download size={16} />}
        label="Export my data"
        description="Download all your data as JSON"
        action={
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => void handleExport()}
            className="inline-flex h-8 items-center gap-1.5 rounded-2xl border border-white/10 px-4 text-[13px] font-medium text-text-secondary transition hover:border-white/20 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Download size={13} aria-hidden="true" />
            Export
          </motion.button>
        }
      />

      {/* Delete account — danger zone */}
      <div className="pt-4">
        <div className="rounded-2xl border border-error/20 bg-error/5 p-4">
          <p className="text-[14px] font-semibold text-error">Delete account</p>
          <p className="mt-0.5 text-[13px] text-error/60">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>

          {!confirming ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setConfirming(true)}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-2xl border border-error/40 px-4 text-sm font-semibold text-error transition hover:border-error/60 hover:bg-error/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete account
            </motion.button>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-[13px] text-text-secondary">
                Type <span className="font-semibold text-text-primary">DELETE</span> to confirm.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                aria-label="Confirm deletion"
                className={cn(
                  "block w-full rounded-2xl border bg-card px-4 py-3 text-sm text-text-primary transition",
                  "placeholder:text-text-secondary focus:outline-none focus:ring-2",
                  "border-error/20 focus:border-error/50 focus:ring-error/10",
                )}
              />
              {error ? (
                <p role="alert" className="text-[13px] text-error">{error}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => void handleDelete()}
                  disabled={!matches || deleting}
                  className={cn(
                    "inline-flex h-10 items-center rounded-2xl bg-error px-5 text-sm font-semibold text-white transition",
                    "hover:bg-error/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </motion.button>
                <button
                  type="button"
                  onClick={() => { setConfirming(false); setConfirmText(""); setError(null); }}
                  disabled={deleting}
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
          )}
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  description,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex-shrink-0 text-text-secondary" aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-text-primary">{label}</p>
          <p className="mt-0.5 text-[12px] text-text-secondary">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
