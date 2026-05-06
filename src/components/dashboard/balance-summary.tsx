"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";

interface BalanceSummaryProps {
  netBalancePaise: number | string;
  groupCount: number;
  displayName: string;
}

// SPEC §4.12 hero card. Three states:
//   • Net > 0  → green gradient ("You are owed ₹X")
//   • Net < 0  → rose gradient  ("You owe ₹X")
//   • Net == 0 → neutral slate  ("You're all settled up 🎉")
//
// The amount counts up from 0 over ~900ms via requestAnimationFrame so the
// dashboard feels responsive on first paint without overdoing motion. We
// respect prefers-reduced-motion and skip the animation entirely there.
export function BalanceSummary({ netBalancePaise, groupCount, displayName }: BalanceSummaryProps) {
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 5) setGreeting("Good evening");
    else if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const net = Number(netBalancePaise);
  const settled = net === 0;
  const owedToYou = net > 0;
  const absPaise = Math.abs(net);

  const accent = settled
    ? "from-slate-700 to-slate-900"
    : owedToYou
      ? "from-emerald-500 via-emerald-600 to-emerald-800"
      : "from-rose-500 via-rose-600 to-rose-800";

  const eyebrow = settled
    ? "All settled up"
    : owedToYou
      ? "You are owed"
      : "You owe";

  return (
    <section
      aria-labelledby="balance-heading"
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-br p-7 text-white shadow-sm sm:p-9",
        accent,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle at 80% 0%, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <p className="text-sm font-medium text-white/80">
        {greeting}, {firstName(displayName)}
      </p>

      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-white/70">
        {eyebrow}
      </p>

      {settled ? (
        <h2
          id="balance-heading"
          className="mt-2 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
        >
          You&apos;re all settled up <span aria-hidden="true">🎉</span>
          {groupCount > 0 ? (
            <span className="block text-base font-normal text-white/80">
              across {groupCount} active {groupCount === 1 ? "group" : "groups"}
            </span>
          ) : null}
        </h2>
      ) : (
        <h2
          id="balance-heading"
          className="mt-2 text-balance text-4xl font-semibold leading-tight tracking-tight tabular-nums sm:text-5xl"
        >
          <CountUpAmount targetPaise={absPaise} />
        </h2>
      )}

      {!settled && groupCount > 0 ? (
        <p className="mt-2 text-sm text-white/80">
          across {groupCount} active {groupCount === 1 ? "group" : "groups"}
        </p>
      ) : null}
    </section>
  );
}

const ANIMATION_MS = 900;

// Count from 0 → targetPaise. We tween in plain JS rather than CSS so the
// rendered string runs through `formatPaise` (₹ + locale grouping + paise),
// which CSS counters can't reproduce.
function CountUpAmount({ targetPaise }: { targetPaise: number }) {
  // useReducer is just a re-render trigger here; the displayed value lives in
  // valueRef so each rAF step doesn't allocate. The dispatch is what causes
  // React to read the ref again after we mutate it.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const valueRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      valueRef.current = targetPaise;
      bump();
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) {
      valueRef.current = targetPaise;
      bump();
      return;
    }
    const start = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      // Ease-out cubic — fast first, settles into the final number.
      const eased = 1 - Math.pow(1 - t, 3);
      valueRef.current = Math.round(targetPaise * eased);
      bump();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [targetPaise]);

  return <span aria-live="polite">{formatPaise(valueRef.current)}</span>;
}


function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}
