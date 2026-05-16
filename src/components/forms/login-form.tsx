"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { m } from "framer-motion";

import { cn } from "@/lib/cn";
import { GoogleButton } from "@/components/forms/google-button";
import { MagicLinkForm } from "@/components/forms/magic-link-form";
import { OtpForm } from "@/components/forms/otp-form";

// Client-side schema. Server re-validates with the canonical `loginSchema`
// (including trim + lowercase normalization on email).
const formSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }).max(254),
  password: z.string().min(1, { message: "Enter your password." }).max(128),
});

type FormValues = z.infer<typeof formSchema>;

interface LoginFormProps {
  callbackUrl: string;
}

interface ServerError {
  message: string;
  unverifiedEmail?: string;
  showRegisterLink?: boolean;
}

// Same-origin guard for the post-login redirect — `callbackUrl` arrives
// from the URL and is attacker-controllable.
function safeInternalPath(candidate: string, fallback: string): string {
  if (
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.startsWith("/\\")
  ) {
    return candidate;
  }
  return fallback;
}

type Mode = "password" | "magic" | "otp";

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<ServerError | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      callbackUrl,
      redirect: false,
    });

    if (!result) {
      setServerError({ message: "Sign-in failed. Please try again." });
      return;
    }
    if (result.error) {
      const code = (result as { code?: string }).code;
      if (code === "EmailNotVerified") {
        setServerError({
          message: "Your email isn't verified yet. Check your inbox or request a new link.",
          unverifiedEmail: values.email,
        });
        return;
      }
      if (code === "AccountNotFound") {
        setServerError({
          message: "No account found with this email.",
          showRegisterLink: true,
        });
        return;
      }
      setServerError({ message: "Incorrect password." });
      return;
    }
    window.location.assign(result.url ?? safeInternalPath(callbackUrl, "/dashboard"));
  }

  return (
    <div className="space-y-5">
      <GoogleButton callbackUrl={callbackUrl} />

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-xs uppercase tracking-wider text-text-secondary">OR</span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Sign-in method"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-card p-1"
      >
        <ModeTab active={mode === "password"} onClick={() => setMode("password")}>
          Password
        </ModeTab>
        <ModeTab active={mode === "magic"} onClick={() => setMode("magic")}>
          Magic Link
        </ModeTab>
        <ModeTab active={mode === "otp"} onClick={() => setMode("otp")}>
          OTP
        </ModeTab>
      </div>

      {mode === "magic" ? (
        <MagicLinkForm />
      ) : mode === "otp" ? (
        <OtpForm />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Email field */}
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-[13px] text-text-secondary"
            >
              Email address
            </label>
            <input
              {...register("email")}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={cn(
                "block h-12 w-full rounded-2xl border bg-card px-4 text-sm text-text-primary transition",
                "placeholder:text-text-secondary",
                "focus:outline-none focus:ring-2",
                errors.email
                  ? "border-error focus:border-error focus:ring-error/10"
                  : "border-white/[0.06] focus:border-accent focus:ring-accent/10",
              )}
            />
            {errors.email ? (
              <p id="email-error" className="mt-1.5 text-[12px] text-error">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          {/* Password field */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-[13px] text-text-secondary"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[12px] font-medium text-accent hover:opacity-80 transition-opacity"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                {...register("password")}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                className={cn(
                  "block h-12 w-full rounded-2xl border bg-card px-4 pr-11 text-sm text-text-primary transition",
                  "placeholder:text-text-secondary",
                  "focus:outline-none focus:ring-2",
                  errors.password
                    ? "border-error focus:border-error focus:ring-error/10"
                    : "border-white/[0.06] focus:border-accent focus:ring-accent/10",
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3.5 text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
              >
                <EyeIcon hidden={showPassword} />
              </button>
            </div>
            {errors.password ? (
              <p id="password-error" className="mt-1.5 text-[12px] text-error">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {/* Server error */}
          {serverError ? (
            <div
              role="alert"
              aria-live="polite"
              className="space-y-1.5 rounded-2xl border border-error/20 bg-error/[0.08] px-4 py-3 text-sm text-error"
            >
              <p>{serverError.message}</p>
              {serverError.unverifiedEmail ? (
                <Link
                  href={`/verify-email/pending?email=${encodeURIComponent(serverError.unverifiedEmail)}`}
                  className="inline-block font-medium underline"
                >
                  Resend verification email
                </Link>
              ) : null}
              {serverError.showRegisterLink ? (
                <Link href="/register" className="inline-block font-medium underline">
                  Create one?
                </Link>
              ) : null}
            </div>
          ) : null}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-2xl bg-accent px-4 text-sm font-semibold text-bg transition",
              "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              "active:scale-[0.98]",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isSubmitting ? <Spinner label="Signing in…" /> : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative rounded-xl px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        active ? "text-text-primary" : "text-text-secondary hover:text-text-primary",
      )}
    >
      {active && (
        <m.span
          layoutId="tab-pill"
          className="absolute inset-0 rounded-xl bg-bg shadow-sm"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
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
