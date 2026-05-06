"use client";

import { forwardRef, useState } from "react";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  id?: string;
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  function AmountInput({ value, onChange, error, id = "amount" }, ref) {
    const [focused, setFocused] = useState(false);

    return (
      <div className="flex flex-col items-center">
        <div className="flex items-end gap-2">
          <span
            className="mb-2 text-2xl font-normal leading-none"
            style={{ color: "#8B93A7" }}
          >
            ₹
          </span>
          <div
            className="pb-1 transition-colors duration-200"
            style={{
              borderBottom: `2px solid ${focused ? "#00C896" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            <input
              ref={ref}
              id={id}
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="0.00"
              aria-invalid={Boolean(error)}
              className="min-w-[120px] bg-transparent text-center text-[32px] font-semibold tabular-nums outline-none placeholder:text-white/[0.15]"
              style={{
                color: "#F5F7FA",
                caretColor: "#00C896",
              }}
            />
          </div>
        </div>
        {error ? (
          <p className="mt-2 text-[12px] text-error">{error}</p>
        ) : null}
      </div>
    );
  },
);
