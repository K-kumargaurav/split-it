import Link from "next/link";

import { cn } from "@/lib/cn";

interface LogoProps {
  href?: string;
  variant?: "light" | "dark";
  className?: string;
}

// Brand mark: a stylised rupee glyph carved out of an indigo square. Pairs
// with the wordmark beside it. Single source of truth — used in auth pages,
// dashboard nav, and emails.
export function Logo({ href = "/", variant = "dark", className }: LogoProps) {
  const wordmarkClass =
    variant === "light" ? "text-white" : "text-slate-900 dark:text-white";
  const markClass =
    variant === "light"
      ? "bg-white dark:bg-slate-900/15 text-white ring-1 ring-white/30 backdrop-blur"
      : "bg-indigo-600 text-white";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 text-base font-semibold tracking-tight",
        wordmarkClass,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold",
          markClass,
        )}
      >
        ₹
      </span>
      SplitEasy
    </Link>
  );
}
