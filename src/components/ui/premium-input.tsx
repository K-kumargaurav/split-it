"use client";

import { forwardRef } from "react";

import { cn } from "@/lib/cn";

interface PremiumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const PremiumInput = forwardRef<HTMLInputElement, PremiumInputProps>(
  function PremiumInput(
    { label, error, hint, leftIcon, rightIcon, className, id, ...props },
    ref,
  ) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint && !error ? `${inputId}-hint` : undefined;

    return (
      <div>
        {label ? (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-[13px] text-text-secondary"
          >
            {label}
          </label>
        ) : null}
        <div className="relative">
          {leftIcon ? (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-text-secondary">
              {leftIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId ?? hintId}
            className={cn(
              "block h-12 w-full rounded-2xl border bg-card px-4 text-sm text-text-primary transition",
              "placeholder:text-text-secondary",
              "focus:outline-none focus:ring-2",
              error
                ? "border-error focus:border-error focus:ring-error/10"
                : "border-white/[0.06] focus:border-accent focus:ring-accent/10",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className,
            )}
            {...props}
          />
          {rightIcon ? (
            <span className="absolute inset-y-0 right-0 flex items-center pr-3.5">
              {rightIcon}
            </span>
          ) : null}
        </div>
        {error ? (
          <p id={errorId} className="mt-1.5 text-[12px] text-error">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1.5 text-[12px] text-text-secondary">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
