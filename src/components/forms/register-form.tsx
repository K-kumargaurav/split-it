"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { registerAction } from "@/server/auth/register";

export function RegisterForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    displayName?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await registerAction({ email, password, displayName });
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        if (result.formError) setFormError(result.formError);
        return;
      }
      setSubmittedEmail(email);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setGoogleSubmitting(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  if (submittedEmail) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900"
      >
        <h2 className="text-base font-semibold">Check your email</h2>
        <p className="mt-2 text-emerald-800">
          If an account does not already exist, we&apos;ve sent a verification link to{" "}
          <span className="font-medium">{submittedEmail}</span>. Click the link to activate
          your account. The link expires in 24 hours.
        </p>
        <p className="mt-3 text-xs text-emerald-700">
          Did not get the email? Check your spam folder, or{" "}
          <Link
            href={`/verify-email/pending?email=${encodeURIComponent(submittedEmail)}`}
            className="font-medium underline"
          >
            request another link
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleSubmitting}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Continue with Google"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.4-1.07 2.59-2.28 3.4v2.83h3.69c2.16-1.99 3.4-4.93 3.4-8.47z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.69-2.83c-1.02.69-2.34 1.1-4.24 1.1-3.26 0-6.02-2.2-7-5.16H1.18v3.24A11.99 11.99 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5 14.2a7.2 7.2 0 0 1 0-4.4V6.56H1.18a12 12 0 0 0 0 10.88L5 14.2z"
          />
          <path
            fill="#EA4335"
            d="M12 4.77c1.77 0 3.36.61 4.61 1.8l3.27-3.27C17.95 1.21 15.24 0 12 0 7.39 0 3.4 2.66 1.18 6.56L5 9.8c.98-2.96 3.74-5.03 7-5.03z"
          />
        </svg>
        {googleSubmitting ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-slate-50 px-3 text-slate-400">or sign up with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-slate-700">
            Your name
          </label>
          <input
            id="displayName"
            type="text"
            name="displayName"
            autoComplete="name"
            required
            placeholder="Asha Patel"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.displayName)}
            aria-describedby={fieldErrors.displayName ? "displayName-error" : undefined}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {fieldErrors.displayName ? (
            <p id="displayName-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.displayName}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {fieldErrors.email ? (
            <p id="email-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
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
                fieldErrors.password ? "password-error" : "password-hint"
              }
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-700"
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
            <p id="password-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.password}
            </p>
          ) : (
            <p id="password-hint" className="mt-1 text-xs text-slate-500">
              At least 8 characters, with 1 uppercase letter and 1 number.
            </p>
          )}
        </div>

        {formError ? (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-8-3.75a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V7a.75.75 0 01.75-.75zm0 8a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            {formError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
