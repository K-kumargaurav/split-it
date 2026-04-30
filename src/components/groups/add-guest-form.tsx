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
        className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        Add Guest (no account needed)
      </button>
    );
  }

  if (added) {
    const guestUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${added.guestPath}`
        : added.guestPath;
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
        <p className="text-sm font-semibold text-emerald-900">
          Guest link for {added.displayName}
        </p>
        <p className="mt-1 text-xs text-emerald-800">
          Share this link with them — anyone with the link can see and pay their balance.
        </p>
        <div className="mt-3 flex items-stretch gap-2">
          <input
            readOnly
            value={guestUrl}
            aria-label="Guest link"
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-xl border border-emerald-200 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white shadow-sm"
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
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-emerald-200 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
          >
            Add another guest
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm"
      noValidate
    >
      <div>
        <label htmlFor="ghost-name" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
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
          className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ghost-email" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Email <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="ghost-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="ghost-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Phone <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="ghost-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || displayName.trim().length === 0}
          className={cn(
            "rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition",
            "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {submitting ? "Adding…" : "Generate guest link"}
        </button>
      </div>
    </form>
  );
}
