"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  type FieldError,
  type UseFormRegisterReturn,
} from "react-hook-form";

import { cn } from "@/lib/cn";
import { emailSchema } from "@/lib/validations/auth";

interface EmailFieldProps {
  registration: UseFormRegisterReturn;
  value: string;
  fieldError?: FieldError;
  serverError?: string;
  // Set true when the form's *submit-time* duplicate check (or the register
  // API's 409) decides the email is taken, even if the on-blur check missed
  // it (race window between blur and submit).
  forceTaken?: boolean;
  onAvailabilityChange: (state: AvailabilityState) => void;
}

export type AvailabilityState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "error" };

const DEBOUNCE_MS = 500;

// Live email-availability check with on-blur trigger + 500ms debounce. We
// intentionally do NOT check on every keystroke: the spec calls for blur-only
// to avoid leaking "is X@gmail.com registered" by typing-pace probing.
export function EmailField({
  registration,
  value,
  fieldError,
  serverError,
  forceTaken,
  onAvailabilityChange,
}: EmailFieldProps) {
  const [state, setState] = useState<AvailabilityState>({ kind: "idle" });
  const lastQueryRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function emit(next: AvailabilityState) {
    setState(next);
    onAvailabilityChange(next);
  }

  // The user types → reset to idle so the previous result doesn't linger
  // against a different address. The API call only fires on blur.
  useEffect(() => {
    emit({ kind: "idle" });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function scheduleCheck() {
    const trimmed = value.trim().toLowerCase();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (trimmed.length === 0) {
      emit({ kind: "idle" });
      return;
    }
    const parsed = emailSchema.safeParse(trimmed);
    if (!parsed.success) {
      // Zod-level error already shown via fieldError. Don't burn a request.
      emit({ kind: "idle" });
      return;
    }

    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = trimmed;
      emit({ kind: "checking" });
      try {
        const res = await fetch("/api/v1/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
        // Drop stale responses if the user re-blurred with a new value.
        if (lastQueryRef.current !== trimmed) return;
        if (!res.ok) {
          emit({ kind: "error" });
          return;
        }
        const body = (await res.json()) as { available?: boolean };
        emit({ kind: body.available ? "available" : "taken" });
      } catch {
        if (lastQueryRef.current !== trimmed) return;
        emit({ kind: "error" });
      }
    }, DEBOUNCE_MS);
  }

  const showTaken = state.kind === "taken" || forceTaken === true;
  const showAvailable = state.kind === "available" && !showTaken;
  const message = serverError ?? fieldError?.message;
  const inputHasError = Boolean(message) || showTaken;

  return (
    <div>
      <label htmlFor="email" className="block text-sm font-medium text-slate-700">
        Email address
      </label>
      <div className="relative mt-1.5">
        <input
          {...registration}
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={inputHasError}
          aria-describedby={inputHasError ? "email-error" : "email-status"}
          onBlur={(e) => {
            registration.onBlur(e);
            scheduleCheck();
          }}
          className={cn(
            "block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition",
            "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
            inputHasError && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
            showAvailable && "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-400",
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <StatusIcon state={state} hasError={inputHasError} showAvailable={showAvailable} />
        </span>
      </div>

      {showTaken ? (
        <p id="email-error" className="mt-1.5 text-xs text-rose-600">
          An account with this email already exists.{" "}
          <Link href="/login" className="font-medium underline hover:text-rose-700">
            Sign in instead?
          </Link>
        </p>
      ) : message ? (
        <p id="email-error" className="mt-1.5 text-xs text-rose-600">
          {message}
        </p>
      ) : (
        <p
          id="email-status"
          className={cn(
            "mt-1.5 text-xs transition-colors",
            showAvailable ? "text-emerald-700" : "text-slate-500",
          )}
        >
          {showAvailable
            ? "Email is available"
            : state.kind === "checking"
              ? "Checking availability…"
              : state.kind === "error"
                ? "Couldn't verify availability. We'll re-check on submit."
                : "We'll send a verification link to this address."}
        </p>
      )}
    </div>
  );
}

interface StatusIconProps {
  state: AvailabilityState;
  hasError: boolean;
  showAvailable: boolean;
}

function StatusIcon({ state, hasError, showAvailable }: StatusIconProps) {
  if (state.kind === "checking") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 animate-spin text-slate-400"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
        <path
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (hasError) {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-rose-500" aria-hidden="true" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L10 9.586 7.707 7.293a1 1 0 1 0-1.414 1.414L8.586 11l-2.293 2.293a1 1 0 1 0 1.414 1.414L10 12.414l2.293 2.293a1 1 0 0 0 1.414-1.414L11.414 11l2.293-2.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (showAvailable) {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-emerald-500" aria-hidden="true" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 0 1 0 1.42l-7.5 7.5a1 1 0 0 1-1.42 0l-3.5-3.5a1 1 0 1 1 1.42-1.42l2.79 2.79 6.79-6.79a1 1 0 0 1 1.42 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return null;
}
