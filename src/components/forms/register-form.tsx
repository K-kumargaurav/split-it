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

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [emailTaken, setEmailTaken] = useState(false);
  // Tracked outside React state because we read it synchronously inside
  // onSubmit to short-circuit before the API call.
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

    // 201: account created. Sign the user in via Credentials. We drive the
    // redirect ourselves so the failure path (rare — credentials we just
    // hashed) can be surfaced as a form error instead of the URL ?error= flow.
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
          disabled={submitting}
          className={cn(
            "flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
            "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
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
