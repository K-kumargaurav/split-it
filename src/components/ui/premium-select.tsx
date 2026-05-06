"use client";

import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/cn";

interface PremiumSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const PremiumSelect = forwardRef<HTMLSelectElement, PremiumSelectProps>(
  function PremiumSelect({ label, error, hint, className, id, children, ...props }, ref) {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = error ? `${selectId}-error` : undefined;
    const hintId = hint && !error ? `${selectId}-hint` : undefined;

    return (
      <div>
        {label ? (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-[13px] text-text-secondary"
          >
            {label}
          </label>
        ) : null}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId ?? hintId}
            className={cn(
              "block h-12 w-full appearance-none rounded-2xl border bg-card px-4 pr-10 text-sm text-text-primary transition",
              "focus:outline-none focus:ring-2",
              error
                ? "border-error focus:border-error focus:ring-error/10"
                : "border-white/[0.06] focus:border-accent focus:ring-accent/10",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-text-secondary">
            <ChevronDown size={16} />
          </span>
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
