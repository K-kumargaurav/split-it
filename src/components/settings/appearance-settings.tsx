"use client";

import { useTheme } from "next-themes";
import { LayoutGroup, m } from "framer-motion";

import { cn } from "@/lib/cn";

const THEMES = [
  { id: "light",  label: "Light" },
  { id: "dark",   label: "Dark" },
  { id: "system", label: "System" },
] as const;

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-text-primary">Theme</p>
        <p className="mt-0.5 text-[12px] text-text-secondary">Choose your preferred color scheme</p>
      </div>

      <LayoutGroup id="theme-picker">
        <div role="radiogroup" aria-label="Theme" className="flex rounded-2xl bg-white/[0.05] p-1">
          {THEMES.map((t) => {
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setTheme(t.id)}
                className="relative rounded-xl px-4 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {isActive && (
                  <m.span
                    layoutId="themePill"
                    className="absolute inset-0 rounded-xl bg-[#0E1116]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 whitespace-nowrap",
                    isActive ? "font-medium text-text-primary" : "text-text-secondary",
                  )}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
