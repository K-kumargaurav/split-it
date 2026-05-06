"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/cn";
import { EmailField, type AvailabilityState } from "@/components/forms/email-field";
import { GoogleButton } from "@/components/forms/google-button";
import { HandleField } from "@/components/forms/handle-field";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordStrength } from "@/components/forms/password-strength";

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

type Phase = "idle" | "submitting" | "signing-in";

interface RegisterErrorBody {
  error?: {
    code?: string;
    message?: string;
    fieldErrors?: Record<string, string>;
  };
}

// Returned by the API on success.
interface RegisterSuccessBody {
  ok: true;
  otpSent: boolean;
  user: { id: string; email: string; handle: string; displayName: string };
}

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [emailTaken, setEmailTaken] = useState(false);
  // After a successful register API call with otpSent:true, we stash the
  // email here and render the OTP step instead of the form.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const emailAvailabilityRef = useRef<AvailabilityState["kind"]>("idle");

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
  const email = watch("email");

  // Duplicate-email is shown only on submit (no enumeration on blur). Clear
  // the flag as soon as the user edits the email so they can retry.
  useEffect(() => {
    if (emailTaken) setEmailTaken(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setServerFieldErrors({});
    setEmailTaken(false);

    // Short-circuit on a known-taken email from the on-blur check, so we
    // don't spend a register call (and a bcrypt hash) on a guaranteed 409.
    if (emailAvailabilityRef.current === "taken") {
      setEmailTaken(true);
      return;
    }

    setPhase("submitting");

    let response: Response;
    try {
      response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
      setPhase("idle");
      return;
    }

    if (!response.ok) {
      let body: RegisterErrorBody = {};
      try {
        body = (await response.json()) as RegisterErrorBody;
      } catch {
        // Body wasn't JSON. Fall through; status-based branches below.
      }
      const code = body.error?.code;

      // Order matters: dispatch on the (status, code) pair so a specific
      // inline error is always preferred over the generic banner.
      if (response.status === 409 && code === "EMAIL_EXISTS") {
        setEmailTaken(true);
      } else if (response.status === 409 && code === "HANDLE_EXISTS") {
        setServerFieldErrors({
          handle: body.error?.message ?? "This handle is already taken.",
        });
      } else if (response.status === 422 && body.error?.fieldErrors) {
        // Zod validation: surface each issue under its own field. We never
        // fall back to the generic banner here — every Zod issue has a path.
        const fe: Partial<Record<keyof FormValues, string>> = {};
        for (const [k, v] of Object.entries(body.error.fieldErrors)) {
          if (k === "email" || k === "password" || k === "displayName" || k === "handle") {
            fe[k] = v;
          }
        }
        setServerFieldErrors(fe);
      } else if (response.status === 429) {
        setServerError(body.error?.message ?? "Too many attempts. Please try again shortly.");
      } else {
        setServerError(
          body.error?.message ?? "Something went wrong. Please try again.",
        );
      }
      setPhase("idle");
      return;
    }

    // 201: account created. The API also sent a verification OTP.
    // Transition to the OTP step — the user signs in there via signIn("otp").
    const body = (await response.json()) as RegisterSuccessBody;
    if (body.otpSent) {
      setPendingEmail(values.email);
      setPhase("idle");
      return;
    }

    // otpSent:false means the email was already verified (OAuth-linked account
    // that just added a password). Sign in directly with credentials.
    setPhase("signing-in");
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (!result || result.error) {
      setServerError("Account created, but sign-in failed. Please sign in manually.");
      setPhase("idle");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const submitting = phase !== "idle" || isSubmitting;

  // Show OTP verification step after successful account creation.
  if (pendingEmail) {
    return (
      <RegistrationOtpStep
        email={pendingEmail}
        onBack={() => setPendingEmail(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <GoogleButton callbackUrl="/dashboard" label="Sign up with Google" />

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-xs uppercase tracking-wider text-text-secondary">
          or sign up with email
        </span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Display name */}
        <div>
          <label
            htmlFor="displayName"
            className="mb-1.5 block text-[13px] text-text-secondary"
          >
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
              errors.displayName || serverFieldErrors.displayName
                ? "displayName-error"
                : undefined
            }
            className={cn(
              "block h-12 w-full rounded-2xl border bg-card px-4 text-sm text-text-primary transition",
              "placeholder:text-text-secondary",
              "focus:outline-none focus:ring-2",
              errors.displayName || serverFieldErrors.displayName
                ? "border-error focus:border-error focus:ring-error/10"
                : "border-white/[0.06] focus:border-accent focus:ring-accent/10",
            )}
          />
          {errors.displayName?.message || serverFieldErrors.displayName ? (
            <p id="displayName-error" className="mt-1.5 text-[12px] text-error">
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

        <EmailField
          registration={register("email")}
          value={email}
          fieldError={errors.email}
          serverError={serverFieldErrors.email}
          forceTaken={emailTaken}
          onAvailabilityChange={(state) => {
            emailAvailabilityRef.current = state.kind;
          }}
        />

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-[13px] text-text-secondary"
          >
            Password
          </label>
          <div className="relative">
            <input
              {...register("password")}
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              aria-invalid={Boolean(errors.password ?? serverFieldErrors.password)}
              aria-describedby={
                errors.password || serverFieldErrors.password
                  ? "password-error"
                  : "password-strength"
              }
              className={cn(
                "block h-12 w-full rounded-2xl border bg-card px-4 pr-11 text-sm text-text-primary transition",
                "placeholder:text-text-secondary",
                "focus:outline-none focus:ring-2",
                errors.password || serverFieldErrors.password
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
          <div id="password-strength">
            <PasswordStrength password={password} />
          </div>
          {errors.password?.message || serverFieldErrors.password ? (
            <p id="password-error" className="mt-1.5 text-[12px] text-error">
              {errors.password?.message ?? serverFieldErrors.password}
            </p>
          ) : null}
        </div>

        {/* Server error */}
        {serverError ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-2xl border px-4 py-3 text-sm text-error"
            style={{
              borderColor: "rgba(255,71,87,0.2)",
              backgroundColor: "rgba(255,71,87,0.08)",
            }}
          >
            {serverError}
          </div>
        ) : null}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "flex h-12 w-full items-center justify-center rounded-2xl bg-accent px-4 text-sm font-semibold text-bg transition",
            "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
            "active:scale-[0.98]",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {phase === "submitting"
            ? "Creating account…"
            : phase === "signing-in"
              ? "Signing you in…"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}

// ─── OTP verification step ────────────────────────────────────────────────────

function RegistrationOtpStep({
  email,
  onBack,
}: {
  email: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function verify(code: string) {
    if (code.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setError(null);

    // The "otp" credentials provider in auth.ts verifies the code, sets
    // emailVerifiedAt via upsertUser, and creates the NextAuth session in
    // one step. No separate "mark verified" call is needed.
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

    router.push(result.url ?? "/dashboard");
    router.refresh();
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
      const data = (await res.json()) as { ok: boolean; formError?: string };
      setResendMessage(
        data.ok
          ? "New code sent — check your inbox."
          : (data.formError ?? "Couldn't resend the code. Please try again."),
      );
      if (data.ok) setOtp("");
    } catch {
      setResendMessage("Network error. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Verify your email</h2>
        <p className="mt-1 text-sm text-text-secondary">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-text-primary">{email}</span>. Enter it below to
          activate your account — it expires in 15 minutes.
        </p>
      </div>

      <div className="space-y-2">
        <label
          id="reg-otp-label"
          className="block text-[13px] text-text-secondary"
        >
          Verification code
        </label>
        <OtpInput
          value={otp}
          onChange={setOtp}
          onComplete={verify}
          disabled={isVerifying}
          invalid={Boolean(error)}
          ariaLabelledBy="reg-otp-label"
          autoFocus
        />
      </div>

      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-2xl border px-4 py-3 text-sm text-error"
          style={{
            borderColor: "rgba(255,71,87,0.2)",
            backgroundColor: "rgba(255,71,87,0.08)",
          }}
        >
          {error}
        </div>
      ) : null}

      {resendMessage ? (
        <p role="status" aria-live="polite" className="text-[12px] text-text-secondary">
          {resendMessage}
        </p>
      ) : null}

      <button
        type="button"
        disabled={isVerifying || otp.length !== 6}
        onClick={() => verify(otp)}
        className={cn(
          "flex h-12 w-full items-center justify-center rounded-2xl bg-accent px-4 text-sm font-semibold text-bg transition",
          "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isVerifying ? "Verifying…" : "Verify and sign in"}
      </button>

      <div className="flex items-center justify-between text-[12px] text-text-secondary">
        <button
          type="button"
          onClick={onBack}
          disabled={isVerifying}
          className="font-medium underline underline-offset-2 hover:text-text-primary transition-colors disabled:opacity-50"
        >
          Back to registration
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={isResending || isVerifying}
          className="font-medium underline underline-offset-2 hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {isResending ? "Sending…" : "Resend code"}
        </button>
      </div>
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
