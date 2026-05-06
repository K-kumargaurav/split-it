"use client";

import { useEffect, useRef, useState } from "react";
import {
  type FieldError,
  type UseFormRegisterReturn,
  type UseFormSetError,
  type UseFormClearErrors,
} from "react-hook-form";

import { cn } from "@/lib/cn";
import { handleSchema } from "@/lib/validations/auth";
import {
  checkHandleAvailability,
  type HandleStatus,
} from "@/server/auth/check-handle";

interface HandleFieldProps {
  registration: UseFormRegisterReturn;
  value: string;
  setError: UseFormSetError<{ handle: string }>;
  clearErrors: UseFormClearErrors<{ handle: string }>;
  fieldError?: FieldError;
  serverError?: string;
}

const DEBOUNCE_MS = 500;

type LookupState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "result"; status: HandleStatus; message: string };

// Live availability lookup with a 500ms debounce, per spec. Only fires when
// the value passes Zod's format check — saves a round trip on every keystroke
// of an obviously invalid handle.
export function HandleField({
  registration,
  value,
  setError,
  clearErrors,
  fieldError,
  serverError,
}: HandleFieldProps) {
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const lastQueryRef = useRef<string>("");

  useEffect(() => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length === 0) {
      setState({ kind: "idle" });
      return;
    }
    const parsed = handleSchema.safeParse(trimmed);
    if (!parsed.success) {
      setState({ kind: "idle" });
      return;
    }

    const timer = setTimeout(async () => {
      lastQueryRef.current = trimmed;
      setState({ kind: "checking" });
      try {
        const result = await checkHandleAvailability(trimmed);
        // Drop stale responses so a slow earlier request doesn't overwrite
        // a fresher one that's already settled.
        if (lastQueryRef.current !== trimmed) return;
        setState({ kind: "result", status: result.status, message: result.message });
        if (result.status !== "available") {
          setError("handle", { type: "manual", message: result.message });
        } else {
          clearErrors("handle");
        }
      } catch {
        if (lastQueryRef.current !== trimmed) return;
        setState({
          kind: "result",
          status: "invalid",
          message: "Couldn't verify availability. Try again.",
        });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, setError, clearErrors]);

  const message = serverError ?? fieldError?.message;
  const isAvailable = state.kind === "result" && state.status === "available";

  return (
    <div>
      <label htmlFor="handle" className="mb-1.5 block text-[13px] text-text-secondary">
        Handle
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm text-text-secondary">
          @
        </span>
        <input
          {...registration}
          id="handle"
          type="text"
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={20}
          placeholder="asha_p"
          aria-invalid={Boolean(message)}
          aria-describedby={message ? "handle-error" : "handle-status"}
          className={cn(
            "block h-12 w-full rounded-2xl border bg-card pl-8 pr-11 text-sm text-text-primary transition",
            "placeholder:text-text-secondary",
            "focus:outline-none focus:ring-2",
            message
              ? "border-error focus:border-error focus:ring-error/10"
              : isAvailable
                ? "border-accent focus:border-accent focus:ring-accent/10"
                : "border-white/[0.06] focus:border-accent focus:ring-accent/10",
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
          <StatusIcon state={state} hasError={Boolean(message)} />
        </span>
      </div>

      {message ? (
        <p id="handle-error" className="mt-1.5 text-[12px] text-error">
          {message}
        </p>
      ) : (
        <p
          id="handle-status"
          className={cn(
            "mt-1.5 text-[12px] transition-colors",
            isAvailable ? "text-accent" : "text-text-secondary",
          )}
        >
          {state.kind === "result" && state.status === "available"
            ? `@${value.trim().toLowerCase()} is available`
            : "Lowercase letters, numbers, and underscores. 3–20 characters."}
        </p>
      )}
    </div>
  );
}

function StatusIcon({ state, hasError }: { state: LookupState; hasError: boolean }) {
  if (state.kind === "checking") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 animate-spin text-text-secondary"
        aria-hidden="true"
      >
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
    );
  }
  if (hasError) {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-error" aria-hidden="true" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L10 9.586 7.707 7.293a1 1 0 1 0-1.414 1.414L8.586 11l-2.293 2.293a1 1 0 1 0 1.414 1.414L10 12.414l2.293 2.293a1 1 0 0 0 1.414-1.414L11.414 11l2.293-2.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (state.kind === "result" && state.status === "available") {
    return (
      <svg
        viewBox="0 0 20 20"
        className="h-4 w-4 text-accent"
        aria-hidden="true"
        fill="currentColor"
      >
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
