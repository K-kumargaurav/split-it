"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { INVITE_LINK_DEFAULT_MAX_USES, INVITE_LINK_MAX_USES_CAP } from "@/lib/validations/invites";

// Modal launched from the members page. Two tabs share the same dialog so
// the inviter can swap between flows without losing context. Each tab posts
// to /api/v1/groups/[id]/invite with the appropriate `type` discriminator.

interface InviteDialogProps {
  groupId: string;
  open: boolean;
  onClose: () => void;
}

interface InviteErrorBody {
  error?: { code?: string; message?: string };
}

const MAX_USES_OPTIONS = [10, 25, 100, 250, INVITE_LINK_MAX_USES_CAP];

export function InviteDialog({ groupId, open, onClose }: InviteDialogProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"email" | "link">("email");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Email tab state.
  const [email, setEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Link tab state.
  const [maxUses, setMaxUses] = useState<number>(INVITE_LINK_DEFAULT_MAX_USES);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkExpires, setLinkExpires] = useState<Date | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ESC closes the dialog so users don't get trapped without a mouse path.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submitEmail(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setEmailError(null);
    setEmailMessage(null);
    if (!email.trim()) {
      setEmailError("Enter an email address.");
      return;
    }
    setEmailSubmitting(true);
    let response: Response;
    try {
      response = await fetch(`/api/v1/groups/${groupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", email: email.trim() }),
      });
    } catch {
      setEmailSubmitting(false);
      setEmailError("Couldn't reach the server. Try again.");
      return;
    }

    setEmailSubmitting(false);
    if (!response.ok) {
      let body: InviteErrorBody = {};
      try {
        body = (await response.json()) as InviteErrorBody;
      } catch {
        // fall through
      }
      setEmailError(body.error?.message ?? "Couldn't send invite.");
      return;
    }

    const body = (await response.json()) as { status: string };
    setEmail("");
    setEmailMessage(
      body.status === "ADDED_DIRECTLY"
        ? "User added to the group."
        : "Invitation email sent.",
    );
    router.refresh();
  }

  async function submitLink(): Promise<void> {
    setLinkError(null);
    setLinkUrl(null);
    setLinkExpires(null);
    setCopied(false);
    setLinkSubmitting(true);
    let response: Response;
    try {
      response = await fetch(`/api/v1/groups/${groupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "link", maxUses }),
      });
    } catch {
      setLinkSubmitting(false);
      setLinkError("Couldn't reach the server. Try again.");
      return;
    }

    setLinkSubmitting(false);
    if (!response.ok) {
      let body: InviteErrorBody = {};
      try {
        body = (await response.json()) as InviteErrorBody;
      } catch {
        // fall through
      }
      setLinkError(body.error?.message ?? "Couldn't generate link.");
      return;
    }

    const body = (await response.json()) as {
      token: string;
      expiresAt: string;
    };
    const url = `${window.location.origin}/invite/${encodeURIComponent(body.token)}`;
    setLinkUrl(url);
    setLinkExpires(new Date(body.expiresAt));
  }

  async function copyLink(): Promise<void> {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-dialog-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <h2
            id="invite-dialog-heading"
            className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
          >
            Invite to group
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div role="tablist" className="mb-5 flex gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          {(["email", "link"] as const).map((value) => {
            const active = tab === value;
            return (
              <button
                key={value}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                {value === "email" ? "Invite by email" : "Share link"}
              </button>
            );
          })}
        </div>

        {tab === "email" ? (
          <form onSubmit={submitEmail} className="space-y-4" noValidate>
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                If they already have an account, they&apos;ll be added directly.
                Otherwise we&apos;ll email them a 7-day join link.
              </p>
            </div>

            {emailError ? (
              <p role="alert" className="text-sm text-rose-600">
                {emailError}
              </p>
            ) : null}
            {emailMessage ? (
              <p role="status" className="text-sm text-emerald-700">
                {emailMessage}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={emailSubmitting}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {emailSubmitting ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="invite-max-uses" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Max uses
              </label>
              <select
                id="invite-max-uses"
                value={maxUses}
                onChange={(e) => setMaxUses(Number.parseInt(e.target.value, 10))}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {MAX_USES_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "use" : "uses"}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Link expires in 7 days. Limited to 10 joins per hour.
              </p>
            </div>

            {linkUrl ? (
              <div className="space-y-2">
                <div className="flex items-stretch gap-2">
                  <input
                    readOnly
                    value={linkUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-medium transition",
                      copied
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800",
                    )}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                {linkExpires ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Expires {linkExpires.toLocaleString("en-IN")}.
                  </p>
                ) : null}
                <p className="text-xs text-amber-700">
                  This is the only time we&apos;ll show this link — copy it now.
                </p>
              </div>
            ) : null}

            {linkError ? (
              <p role="alert" className="text-sm text-rose-600">
                {linkError}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={submitLink}
                disabled={linkSubmitting}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {linkSubmitting ? "Generating…" : linkUrl ? "Generate new" : "Generate link"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
