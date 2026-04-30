"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

// Three-way Light → Dark → System cycle.
//
// We render an idempotent placeholder during SSR / before hydration, since
// `theme` is undefined on the server and we don't want a flash of the wrong
// icon. The placeholder reserves the same dimensions so the navbar layout
// doesn't shift on hydration.

type ThemeChoice = "light" | "dark" | "system";

const ORDER: readonly ThemeChoice[] = ["light", "dark", "system"];

const NEXT: Record<ThemeChoice, ThemeChoice> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const LABEL: Record<ThemeChoice, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current: ThemeChoice =
    mounted && theme && (ORDER as readonly string[]).includes(theme)
      ? (theme as ThemeChoice)
      : "system";

  const next = NEXT[current];
  const ariaLabel = mounted
    ? `Theme: ${LABEL[current]}. Click to switch to ${LABEL[next]}.`
    : "Toggle theme";

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={() => setTheme(next)}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition",
        "hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
        "dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white",
        "dark:focus-visible:ring-offset-slate-900",
        className,
      )}
    >
      <Sun
        aria-hidden="true"
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          mounted && current === "light"
            ? "scale-100 rotate-0 opacity-100"
            : "scale-0 -rotate-90 opacity-0",
        )}
      />
      <Moon
        aria-hidden="true"
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          mounted && current === "dark"
            ? "scale-100 rotate-0 opacity-100"
            : "scale-0 rotate-90 opacity-0",
        )}
      />
      <Monitor
        aria-hidden="true"
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          !mounted || current === "system"
            ? "scale-100 rotate-0 opacity-100"
            : "scale-0 rotate-45 opacity-0",
        )}
      />
    </button>
  );
}
