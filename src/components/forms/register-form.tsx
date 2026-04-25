"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/cn";
import { GoogleButton } from "@/components/forms/google-button";
import { HandleField } from "@/components/forms/handle-field";
import { PasswordStrength } from "@/components/forms/password-strength";
import { registerAction } from "@/server/auth/register";

// Client-side schema. Server re-validates with the canonical `registerSchema`
// (including normalization of email + handle to lowercase).
const formSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { message: "Name is required." })
    .max(80, { message: "Name is too long." }),
  handle: z
    .string()
    .min(3, { message: "Handle must be at least 3 characters." })
    .max(20, { message: "Handle must be at most 20 characters." })
    .regex(/^[a-z][a-z0-9_]*$/, {
      message: "Use lowercase letters, numbers, and underscores. Must start with a letter.",
    }),
  email: z.email({ message: "Enter a valid email address." }).max(254),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
    .max(128)
    .refine((s) => /[A-Z]/.test(s), { message: "Must include at least one uppercase letter." })
    .refine((s) => /[0-9]/.test(s), { message: "Must include at least one number." }),
});

type FormValues = z.infer<typeof formSchema>;

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: { displayName: "", handle: "", email: "", password: "" },
  });

  const password = watch("password");
  const handle = watch("handle");

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setServerFieldErrors({});
    try {
      const result = await registerAction({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        handle: values.handle,
      });
      if (!result.ok) {
        if (result.fieldErrors) setServerFieldErrors(result.fieldErrors);
        if (result.formError) setServerError(result.formError);
        return;
      }
      setSubmittedEmail(values.email);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  if (submittedEmail) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900"
      >
        <h2 className="text-base font-semibold">Check your email</h2>
        <p className="mt-2 text-emerald-800">
          If an account doesn&apos;t already exist, we&apos;ve sent a verification link to{" "}
          <span className="font-medium">{submittedEmail}</span>. Click the link to activate your
          account. The link expires in 24 hours.
        </p>
        <p className="mt-3 text-xs text-emerald-700">
          Didn&apos;t get the email? Check your spam folder, or{" "}
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
    <div className="space-y-5">
      <GoogleButton callbackUrl="/dashboard" label="Sign up with Google" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-50 px-3 text-xs uppercase tracking-wider text-slate-400">
            or sign up with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-slate-700">
            Display name
          </label>
          <input
            {...register("displayName")}
            id="displayName"
            type="text"
            autoComplete="name"
            placeholder="Asha Patel"
            aria-invalid={Boolean(errors.displayName ?? serverFieldErrors.displayName)}
            aria-describedby={
              errors.displayName || serverFieldErrors.displayName ? "displayName-error" : undefined
            }
            className={cn(
              "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition",
              "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              (errors.displayName || serverFieldErrors.displayName) && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
            )}
          />
          {(errors.displayName?.message || serverFieldErrors.displayName) ? (
            <p id="displayName-error" className="mt-1.5 text-xs text-rose-600">
              {errors.displayName?.message ?? serverFieldErrors.displayName}
            </p>
          ) : null}
        </div>

        <HandleField
          registration={register("handle")}
          value={handle}
          setError={setError as never}
          clearErrors={clearErrors as never}
          fieldError={errors.handle}
          serverError={serverFieldErrors.handle}
        />

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            {...register("email")}
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email ?? serverFieldErrors.email)}
            aria-describedby={errors.email || serverFieldErrors.email ? "email-error" : undefined}
            className={cn(
              "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition",
              "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              (errors.email || serverFieldErrors.email) && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
            )}
          />
          {(errors.email?.message || serverFieldErrors.email) ? (
            <p id="email-error" className="mt-1.5 text-xs text-rose-600">
              {errors.email?.message ?? serverFieldErrors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              {...register("password")}
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              aria-invalid={Boolean(errors.password ?? serverFieldErrors.password)}
              aria-describedby={errors.password || serverFieldErrors.password ? "password-error" : "password-strength"}
              className={cn(
                "block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition",
                "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                (errors.password || serverFieldErrors.password) && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700 focus:outline-none focus:text-slate-700"
            >
              <EyeIcon hidden={showPassword} />
            </button>
          </div>
          <div id="password-strength">
            <PasswordStrength password={password} />
          </div>
          {(errors.password?.message || serverFieldErrors.password) ? (
            <p id="password-error" className="mt-1.5 text-xs text-rose-600">
              {errors.password?.message ?? serverFieldErrors.password}
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
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l1.92 1.92A11.005 11.005 0 0 0 .458 10C1.732 14.057 5.522 17 10 17c1.67 0 3.247-.41 4.633-1.135l2.087 2.087a.75.75 0 1 0 1.06-1.06L3.28 2.22zM10 14a4 4 0 0 1-3.96-4.6l1.51 1.51a2 2 0 0 0 2.54 2.54l1.51 1.51A4 4 0 0 1 10 14z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      <path
        fillRule="evenodd"
        d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
