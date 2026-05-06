"use client";

import { cn } from "@/lib/cn";

interface PasswordStrengthProps {
  password: string;
}

interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hint: string;
  barClass: string;
  textClass: string;
}

// Simple heuristic — not a substitute for zxcvbn, but cheap, deterministic,
// and good enough as a UX signal during signup. The server still enforces the
// hard requirements (≥ 8 chars, 1 uppercase, 1 number) via Zod.
function score(pw: string): Strength {
  if (pw.length === 0) {
    return {
      score: 0,
      label: "Enter a password",
      hint: "8+ characters, 1 uppercase, 1 number.",
      barClass: "bg-white/[0.08]",
      textClass: "text-text-secondary",
    };
  }
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const clamped = Math.min(s, 4) as 0 | 1 | 2 | 3 | 4;

  const presets: Record<0 | 1 | 2 | 3 | 4, Omit<Strength, "score">> = {
    0: { label: "Too short", hint: "At least 8 characters.", barClass: "bg-error", textClass: "text-error" },
    1: { label: "Weak", hint: "Add a mix of cases and numbers.", barClass: "bg-error", textClass: "text-error" },
    2: { label: "Fair", hint: "Try a longer phrase.", barClass: "bg-warning", textClass: "text-warning" },
    3: { label: "Strong", hint: "Nice — that'll do.", barClass: "bg-accent", textClass: "text-accent" },
    4: { label: "Excellent", hint: "Great password.", barClass: "bg-accent", textClass: "text-accent" },
  };

  return { score: clamped, ...presets[clamped] };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const s = score(password);
  const filled = s.score === 0 && password.length === 0 ? 0 : s.score === 0 ? 1 : s.score;

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= filled ? s.barClass : "bg-white/[0.08]",
            )}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[12px]">
        <span className={cn("font-medium", s.textClass)}>{s.label}</span>
        <span className="text-text-secondary">{s.hint}</span>
      </div>
    </div>
  );
}
