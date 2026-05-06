"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/cn";
import { OtpInput } from "@/components/ui/otp-input";

// ─── Schemas ────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }).max(254),
});
type EmailValues = z.infer<typeof emailSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

type Step =
  | { name: "email" }
  | { name: "otp"; email: string };

interface SendOtpResult {
  ok: boolean;
  formError?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OtpForm() {
  const [step, setStep] = useState<Step>({ name: "email" });

  if (step.name === "otp") {
    return <OtpStep email={step.email} onBack={() => setStep({ name: "email" })} />;
  }

  return <EmailStep onSent={(email) => setStep({ name: "otp", email })} />;
}

// ─── Step 1: collect email and send OTP ──────────────────────────────────────

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit(values: EmailValues) {
    setServerError(null);

    let response: Response;
    try {
      response = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
    } catch {
      setServerError("Network error. Please check your connection and try again.");
      return;
    }

    let result: SendOtpResult;
    try {
      result = (await response.json()) as SendOtpResult;
    } catch {
      setServerError("Unexpected response from server. Please try again.");
      return;
    }

    if (!result.ok) {
      setServerError(result.formError ?? "Couldn't send the code. Please try again.");
      return;
    }

    onSent(values.email);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Enter your email and we&apos;ll send you a 6-digit sign-in code. No password needed.
      </p>

      <div>
        <label
          htmlFor="otp-email"
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Email address
        </label>
        <input
          {...register("email")}
          id="otp-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "otp-email-error" : undefined}
          className={cn(
            "mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition",
            "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
            errors.email && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
          )}
        />
        {errors.email ? (
          <p id="otp-email-error" className="mt-1.5 text-xs text-rose-600">
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
        {isSubmitting ? <Spinner label="Sending code…" /> : "Email me a sign-in code"}
      </button>
    </form>
  );
}

// ─── Step 2: enter OTP ───────────────────────────────────────────────────────

interface OtpStepProps {
  email: string;
  onBack: () => void;
}

function OtpStep({ email, onBack }: OtpStepProps) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function verify(code: string) {
    if (code.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setError(null);

    const result = await signIn("otp", {
      email,
      otp: code,
      redirect: false,
    });

    if (!result || result.error) {
      setError("That code is incorrect or has expired. Check your email and try again.");
      setOtp("");
      setIsVerifying(false);
      return;
    }

    // signIn with redirect:false sets the session cookie. Navigate to the
    // callbackUrl returned by NextAuth (or fall back to /dashboard).
    window.location.assign(result.url ?? "/dashboard");
  }

  async function resend() {
    setIsResending(true);
    setResendMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as SendOtpResult;
      if (data.ok) {
        setResendMessage("New code sent — check your inbox.");
        setOtp("");
      } else {
        setResendMessage(data.formError ?? "Couldn't resend the code. Please try again.");
      }
    } catch {
      setResendMessage("Network error. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        We sent a 6-digit code to{" "}
        <span className="font-medium text-slate-900 dark:text-white">{email}</span>. Enter it
        below — it expires in 15 minutes.
      </p>

      <div className="space-y-2">
        <label
          id="otp-label"
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Sign-in code
        </label>
        <OtpInput
          value={otp}
          onChange={setOtp}
          onComplete={verify}
          disabled={isVerifying}
          invalid={Boolean(error)}
          ariaLabelledBy="otp-label"
          autoFocus
        />
      </div>

      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
        >
          {error}
        </div>
      ) : null}

      {resendMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-slate-600 dark:text-slate-400"
        >
          {resendMessage}
        </p>
      ) : null}

      <button
        type="button"
        disabled={isVerifying || otp.length !== 6}
        onClick={() => verify(otp)}
        className={cn(
          "flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
          "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isVerifying ? <Spinner label="Verifying…" /> : "Verify code"}
      </button>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={onBack}
          disabled={isVerifying}
          className="font-medium underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50"
        >
          Use a different email
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={isResending || isVerifying}
          className="font-medium underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50"
        >
          {isResending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

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
