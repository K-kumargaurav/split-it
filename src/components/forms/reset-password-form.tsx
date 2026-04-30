"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { resetPasswordAction } from "@/server/auth/reset-password";

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; token?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const result = await resetPasswordAction({ token, password });
      if (result.ok) {
        setDone(true);
        return;
      }
      if (result.reason === "invalid" || result.reason === "expired") {
        setTokenInvalid(true);
        return;
      }
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.formError) setFormError(result.formError);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          Your password has been reset. You can now sign in with your new password.
        </div>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Continue to sign in
        </Link>
      </div>
    );
  }

  if (tokenInvalid) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          This reset link is invalid or has expired. Request a new one to try again.
        </div>
        <Link
          href="/forgot-password"
          className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          New password
        </label>
        <div className="relative mt-1.5">
          <input
            id="new-password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters, 1 uppercase, 1 number"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "new-password-error" : "new-password-hint"
            }
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 pr-10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none focus:text-slate-700 dark:focus:text-slate-200"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              {showPassword ? (
                <path
                  fillRule="evenodd"
                  d="M3.28 2.22a.75.75 0 00-1.06 1.06l1.92 1.92A11.005 11.005 0 00.458 10C1.732 14.057 5.522 17 10 17c1.67 0 3.247-.41 4.633-1.135l2.087 2.087a.75.75 0 101.06-1.06L3.28 2.22zM10 14a4 4 0 01-3.96-4.6l1.51 1.51a2 2 0 002.54 2.54l1.51 1.51A4 4 0 0110 14zm0-8c-1.67 0-3.247.41-4.633 1.135L4.18 5.948A8.99 8.99 0 0110 4c4.478 0 8.268 2.943 9.542 7-.42 1.34-1.16 2.55-2.13 3.55l-1.41-1.41A6.97 6.97 0 0019.542 11C18.268 6.943 14.478 4 10 4z"
                  clipRule="evenodd"
                />
              ) : (
                <>
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fillRule="evenodd"
                    d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </>
              )}
            </svg>
          </button>
        </div>
        {fieldErrors.password ? (
          <p id="new-password-error" className="mt-1 text-xs text-red-600">
            {fieldErrors.password}
          </p>
        ) : (
          <p id="new-password-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            At least 8 characters, with 1 uppercase letter and 1 number.
          </p>
        )}
      </div>

      {formError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {formError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
