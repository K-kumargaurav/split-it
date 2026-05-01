"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/cn";

// Edit-in-place profile form. The "Save" button is disabled until at least
// one field has changed against the server-provided initial values, so users
// don't accidentally submit an unchanged record (which would be a 422 from
// the API's "at least one field" guard).

interface ProfileFormInitial {
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  upiId: string | null;
  email: string | null;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function ProfileForm({ initial }: { initial: ProfileFormInitial }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [handle, setHandle] = useState(initial.handle);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? "");
  const [upiId, setUpiId] = useState(initial.upiId ?? "");

  const [savedSnapshot, setSavedSnapshot] = useState<ProfileFormInitial>(initial);

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Clear the success banner after a brief delay so it doesn't linger across
  // subsequent edits.
  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(false), 3000);
    return () => window.clearTimeout(t);
  }, [success]);

  const dirty =
    displayName.trim() !== savedSnapshot.displayName ||
    handle.trim() !== savedSnapshot.handle ||
    (avatarUrl.trim() || null) !== savedSnapshot.avatarUrl ||
    (upiId.trim() || null) !== savedSnapshot.upiId;

  const initials = (displayName[0] ?? handle[0] ?? "?").toUpperCase();

  async function handleAvatarFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/users/me/avatar", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
        throw new Error(body?.error?.message ?? `Upload failed (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { avatarUrl: string | null };
      const newUrl = data.avatarUrl ?? "";
      setAvatarUrl(newUrl);
      // The server already persisted the URL, so the saved snapshot moves with
      // it. Other dirty fields stay dirty until the main Save runs.
      setSavedSnapshot((s) => ({ ...s, avatarUrl: newUrl || null }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload avatar.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty || submitting) return;
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const body: Record<string, unknown> = {};
    if (displayName.trim() !== savedSnapshot.displayName) body.displayName = displayName.trim();
    if (handle.trim() !== savedSnapshot.handle) body.handle = handle.trim();
    if ((avatarUrl.trim() || null) !== savedSnapshot.avatarUrl) {
      body.avatarUrl = avatarUrl.trim();
    }
    if ((upiId.trim() || null) !== savedSnapshot.upiId) {
      body.upiId = upiId.trim();
    }

    try {
      const res = await fetch("/api/v1/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
        throw new Error(errBody?.error?.message ?? `Save failed (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as {
        user: {
          displayName: string;
          handle: string;
          avatarUrl: string | null;
          upiId: string | null;
        };
      };
      setSavedSnapshot((s) => ({
        ...s,
        displayName: data.user.displayName,
        handle: data.user.handle,
        avatarUrl: data.user.avatarUrl,
        upiId: data.user.upiId,
      }));
      setDisplayName(data.user.displayName);
      setHandle(data.user.handle);
      setAvatarUrl(data.user.avatarUrl ?? "");
      setUpiId(data.user.upiId ?? "");
      setSuccess(true);
      toast.success("Profile saved");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save profile.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8"
    >
      <section aria-labelledby="avatar-heading">
        <h2
          id="avatar-heading"
          className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          Avatar
        </h2>
        <div className="mt-3 flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Your avatar"
              className="h-16 w-16 flex-shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xl font-semibold text-white"
            >
              {initials}
            </span>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Change avatar"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleAvatarFile(f);
              }}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              JPEG, PNG, or WebP up to 5MB. Resized to 512×512.
            </p>
          </div>
        </div>
      </section>

      <Field
        id="displayName"
        label="Display name"
        value={displayName}
        onChange={setDisplayName}
        autoComplete="name"
        required
      />

      <Field
        id="handle"
        label="Handle"
        prefix="@"
        value={handle}
        onChange={(v) => setHandle(v.toLowerCase())}
        autoComplete="username"
        hint="Lowercase letters, numbers, and underscores. Must start with a letter."
        required
      />

      <Field
        id="upiId"
        label="UPI ID"
        value={upiId}
        onChange={setUpiId}
        placeholder="yourname@upi"
        hint="yourname@upi or phone@bank — used to receive settlement payments."
      />

      {initial.email ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
          </label>
          <p className="mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
            {initial.email}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Email changes aren&apos;t supported yet.
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          Profile saved.
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={!dirty || submitting}
          className={cn(
            "inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition",
            "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:bg-indigo-300",
          )}
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  prefix?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  hint,
  placeholder,
  autoComplete,
  required,
  prefix,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        {label}
      </label>
      <div
        className={cn(
          "mt-1.5 flex items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm",
          "focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500",
        )}
      >
        {prefix ? (
          <span className="pl-3 text-sm text-slate-400" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          name={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="block w-full bg-transparent px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
        />
      </div>
      {hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
