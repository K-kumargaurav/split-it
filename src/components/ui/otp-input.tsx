"use client";

import { useEffect, useRef } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";

import { cn } from "@/lib/cn";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabelledBy?: string;
}

// Six individual cells, controlled by a single string `value` of digits.
// Behaviour:
//   • Type a digit  → write at the focused cell, advance focus.
//   • Backspace     → if cell has a digit, delete it; otherwise focus prev.
//   • Arrow ←/→     → navigate cells.
//   • Paste 6 digits→ fills all cells from the focused cell onward; ignores
//                     non-digit characters (handles "123 456" autofill, etc.)
//   • onComplete    → fires once when all `length` cells are populated.
//
// Built without an external dependency. Each input is a real <input> so
// password managers / SMS-OTP autofill on iOS/Android can populate them.
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  autoFocus = true,
  disabled = false,
  invalid = false,
  ariaLabelledBy,
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  const digits: string[] = Array.from({ length }, (_, i) => value[i] ?? "");

  function commit(next: string) {
    const trimmed = next.slice(0, length);
    onChange(trimmed);
    if (trimmed.length === length) onComplete?.(trimmed);
  }

  function focusCell(idx: number) {
    inputs.current[Math.max(0, Math.min(length - 1, idx))]?.focus();
  }

  function handleInput(idx: number, raw: string) {
    const onlyDigits = raw.replace(/\D/g, "");
    if (onlyDigits.length === 0) {
      // Browser sent an empty value (some IMEs do this on selection-replace).
      commit(value.slice(0, idx) + value.slice(idx + 1));
      return;
    }
    const before = value.slice(0, idx);
    const merged = (before + onlyDigits).slice(0, length);
    commit(merged);
    const lastWritten = Math.min(idx + onlyDigits.length, length) - 1;
    // Focus the cell AFTER the last digit we wrote (or the final cell).
    focusCell(Math.min(lastWritten + 1, length - 1));
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[idx]) {
        commit(value.slice(0, idx) + value.slice(idx + 1));
        return;
      }
      if (idx > 0) {
        // Empty cell + backspace → delete the previous cell's digit and move.
        commit(value.slice(0, idx - 1) + value.slice(idx));
        focusCell(idx - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      focusCell(idx - 1);
      return;
    }
    if (e.key === "ArrowRight" && idx < length - 1) {
      e.preventDefault();
      focusCell(idx + 1);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      focusCell(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      focusCell(length - 1);
    }
  }

  function handlePaste(idx: number, e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const onlyDigits = text.replace(/\D/g, "");
    if (!onlyDigits) return;
    e.preventDefault();
    const before = value.slice(0, idx);
    const merged = (before + onlyDigits).slice(0, length);
    commit(merged);
    focusCell(Math.min(idx + onlyDigits.length, length - 1));
  }

  return (
    <div
      role="group"
      aria-labelledby={ariaLabelledBy}
      aria-invalid={invalid || undefined}
      className="flex items-center justify-between gap-2 sm:gap-3"
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          value={d}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "h-12 w-10 rounded-xl border bg-white dark:bg-slate-900 text-center font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-white shadow-sm transition sm:h-14 sm:w-12 sm:text-2xl",
            "border-slate-300 dark:border-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
            invalid && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
            disabled && "cursor-not-allowed bg-slate-50 dark:bg-slate-800 text-slate-400",
          )}
        />
      ))}
    </div>
  );
}
