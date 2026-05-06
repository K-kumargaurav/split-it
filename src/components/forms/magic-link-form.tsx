"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/cn";
import { requestMagicLink } from "@/server/auth/magic-link";

const emailSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }).max(254),
});
type EmailValues = z.infer<typeof emailSchema>;

export function MagicLinkForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit(values: EmailValues) {
    setServerError(null);
    const result = await requestMagicLink({ email: values.email });
    if (!result.ok) {
      setServerError(result.formError ?? result.fieldError ?? "Couldn't send the link. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"
      >
        <h2 className="text-base font-semibold">Check your email</h2>
        <p className="mt-1 text-emerald-800">
          We sent a sign-in link to{" "}
          <span className="font-medium">{getValues("email")}</span>. Click the link
          to sign in — no code needed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Enter your email and we&apos;ll send you a one-click sign-in link. No password or
        code needed.
      </p>

      <div>
        <label
          htmlFor="magic-email"
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Email address
        </label>
        <input
          {...register("email")}
          id="magic-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "magic-email-error" : undefined}
          className={cn(
            "mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition",
            "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
            errors.email && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
          )}
        />
        {errors.email ? (
          <p id="magic-email-error" className="mt-1.5 text-xs text-rose-600">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
        >
          {serverError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          "flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
          "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isSubmitting ? <Spinner label="Sending link…" /> : "Email me a sign-in link"}
      </button>
    </form>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          opacity="0.25"
        />
        <path
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      {label}
    </span>
  );
}
