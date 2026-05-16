"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

interface AddGuestFormProps {
  groupId: string;
}

interface AddedGhost {
  id: string;
  displayName: string;
  guestPath: string;
}

export function AddGuestForm({ groupId }: AddGuestFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<AddedGhost | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, string> = { displayName: displayName.trim() };
      if (email.trim()) body.email = email.trim();
      if (phone.trim()) body.phone = phone.trim();

      const response = await fetch(`/api/v1/groups/${groupId}/members/ghost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(json?.error?.message ?? "Couldn't add the guest.");
        return;
      }
      const json = (await response.json()) as { ghost: AddedGhost };
      setAdded(json.ghost);
      router.refresh();
    } catch {
      setError("Couldn't add the guest. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset(): void {
    setDisplayName("");
    setEmail("");
    setPhone("");
    setError(null);
    setAdded(null);
    setCopied(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-card px-4 py-2.5 text-sm font-medium text-text-primary transition",
          "hover:border-white/10 hover:bg-surface-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        )}
      >
        <GhostIcon />
        Add guest (no account needed)
      </button>
    );
  }

  if (added) {
    const guestUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${added.guestPath}`
        : added.guestPath;
    return (
      <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
        <p className="text-[14px] font-semibold text-accent">
          Guest link for {added.displayName}
        </p>
        <p className="mt-1 text-[13px] text-accent/70">
          Share this link with them — anyone with the link can see and pay their balance.
        </p>
        <div className="mt-3 flex items-stretch gap-2">
          <input
            readOnly
            value={guestUrl}
            aria-label="Guest link"
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-xl border border-accent/20 bg-card px-3 py-2.5 font-mono text-[12px] text-text-primary"
          />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(guestUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // Older browsers — input is already selectable.
              }
            }}
            className="rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-[#0E1116] transition hover:opacity-90"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-accent/20 bg-accent/5 px-3.5 py-2 text-[13px] font-medium text-accent transition hover:bg-accent/10"
          >
            Add another guest
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="rounded-xl border border-white/[0.06] bg-card px-3.5 py-2 text-[13px] font-medium text-text-secondary transition hover:border-white/10 hover:text-text-primary"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="ghost-name" className="mb-1.5 block text-[13px] text-text-secondary">
          Display name
        </label>
        <input
          id="ghost-name"
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          placeholder="e.g. Cousin Riya"
          className={cn(
            "block h-12 w-full rounded-2xl border border-white/[0.06] bg-card px-4 text-sm text-text-primary transition",
            "placeholder:text-text-secondary",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10",
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ghost-email" className="mb-1.5 block text-[13px] text-text-secondary">
            Email <span className="text-text-secondary/60">(optional)</span>
          </label>
          <input
            id="ghost-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            className={cn(
              "block h-12 w-full rounded-2xl border border-white/[0.06] bg-card px-4 text-sm text-text-primary transition",
              "placeholder:text-text-secondary",
              "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10",
            )}
          />
        </div>
        <div>
          <label htmlFor="ghost-phone" className="mb-1.5 block text-[13px] text-text-secondary">
            Phone <span className="text-text-secondary/60">(optional)</span>
          </label>
          <input
            id="ghost-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            className={cn(
              "block h-12 w-full rounded-2xl border border-white/[0.06] bg-card px-4 text-sm text-text-primary transition",
              "placeholder:text-text-secondary",
              "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10",
            )}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[12px] text-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-2xl border border-white/[0.06] bg-card px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-white/10 hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || displayName.trim().length === 0}
          className={cn(
            "rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#0E1116] transition",
            "hover:opacity-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {submitting ? "Adding..." : "Generate guest link"}
        </button>
      </div>
    </form>
  );
}

function GhostIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 text-text-secondary" fill="currentColor" aria-hidden="true">
      <path d="M8 1a5 5 0 0 0-5 5v4.5a1.5 1.5 0 0 0 2.15 1.35l.7-.35a.5.5 0 0 1 .45 0l1.25.63a.5.5 0 0 0 .45 0l1.25-.63a.5.5 0 0 1 .45 0l.7.35A1.5 1.5 0 0 0 13 10.5V6a5 5 0 0 0-5-5zM6.5 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm4-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
    </svg>
  );
}
