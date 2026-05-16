"use client";

import { m } from "framer-motion";

import { cn } from "@/lib/cn";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  "aria-label": string;
}

export function ToggleSwitch({
  checked,
  onChange,
  "aria-label": ariaLabel,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        checked ? "bg-accent" : "bg-white/10",
      )}
    >
      <m.span
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute inline-block h-4 w-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}
