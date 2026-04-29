"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/cn";

const formSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }).max(254),
});
type FormValues = z.infer<typeof formSchema>;

interface MagicLinkResult {
  ok: boolean;
  formError?: string;
  fieldError?: string;
}

export function MagicLinkForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    let response: Response;
    try {
      response = await fetch("/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
    } catch {
      setServerError("Couldn't send the link. Please try again.");
      return;
    }
    let result: MagicLinkResult;
    try {
      result = (await response.json()) as MagicLinkResult;
    } catch {
      setServerError("Couldn't send the link. Please try again.");
      return;
    }
    if (!result.ok) {
      setServerError(
        result.formError ?? result.fieldError ?? "Couldn't send the link. Please try again.",
      );
      return;
    }
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"
      >
        <h2 className="text-base font-semibold">Check your inbox</h2>
        <p className="mt-2 text-emerald-800">
          We&apos;ve sent a sign-in link to <span className="font-medium">{sentTo}</span>. Click
          the link in the email to continue. The link expires in 24 hours.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-3 text-xs font-medium text-emerald-800 underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600">
        Enter your email and we&apos;ll send you a one-tap sign-in link. No password needed.
      </p>

      <div>
        <label htmlFor="magic-email" className="block text-sm font-medium text-slate-700">
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
            "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition",
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
        {isSubmitting ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
