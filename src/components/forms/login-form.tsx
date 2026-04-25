"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/cn";
import { GoogleButton } from "@/components/forms/google-button";
import { MagicLinkForm } from "@/components/forms/magic-link-form";

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

type Mode = "password" | "magic";

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
      setServerError({ message: "Invalid email or password." });
      return;
    }
    window.location.assign(result.url ?? safeInternalPath(callbackUrl, "/dashboard"));
  }

  return (
    <div className="space-y-5">
      <GoogleButton callbackUrl={callbackUrl} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-50 px-3 text-xs uppercase tracking-wider text-slate-400">
            or
          </span>
        </div>
      </div>

      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <ModeTab active={mode === "password"} onClick={() => setMode("password")}>
          Password
        </ModeTab>
        <ModeTab active={mode === "magic"} onClick={() => setMode("magic")}>
          Magic link
        </ModeTab>
      </div>

      {mode === "magic" ? (
        <MagicLinkForm />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={cn(
                "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition",
                "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                errors.email && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
              )}
            />
            {errors.email ? (
              <p id="email-error" className="mt-1.5 text-xs text-rose-600">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative mt-1.5">
              <input
                {...register("password")}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                className={cn(
                  "block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition",
                  "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                  errors.password && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
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
            {errors.password ? (
              <p id="password-error" className="mt-1.5 text-xs text-rose-600">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <div
              role="alert"
              aria-live="polite"
              className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
            >
              <p>{serverError.message}</p>
              {serverError.unverifiedEmail ? (
                <Link
                  href={`/verify-email/pending?email=${encodeURIComponent(serverError.unverifiedEmail)}`}
                  className="inline-block font-medium text-rose-800 underline"
                >
                  Resend verification email
                </Link>
              ) : null}
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
        "rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
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
