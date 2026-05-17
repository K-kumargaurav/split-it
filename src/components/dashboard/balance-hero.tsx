"use client";

import { useEffect, useState } from "react";
import { useMotionValue, useSpring } from "framer-motion";

import { formatPaise } from "@/lib/format";
import { FadeIn, StaggerChildren } from "@/components/ui/motion";

interface BalanceHeroProps {
  netBalancePaise: string;
  owedToYouPaise: string;
  youOwePaise: string;
  settledThisMonthPaise: string;
  userName: string;
}

function getISTGreeting(): string {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10,
  );
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function AnimatedBalance({ targetPaise }: { targetPaise: number }) {
  const count = useMotionValue(0);
  const smoothCount = useSpring(count, { stiffness: 60, damping: 20 });
  const [displayPaise, setDisplayPaise] = useState(0);

  useEffect(() => {
    const unsub = smoothCount.on("change", (latest: number) => {
      setDisplayPaise(Math.round(latest));
    });
    count.set(targetPaise);
    return unsub;
  }, [count, smoothCount, targetPaise]);

  return (
    <span aria-live="polite" aria-atomic="true">
      {formatPaise(displayPaise)}
    </span>
  );
}

const STATS = [
  { label: "Owed to you", key: "owedToYou" as const, colorClass: "text-[#00C896]" },
  { label: "You owe", key: "youOwe" as const, colorClass: "text-[#FF4757]" },
  { label: "Settled this month", key: "settled" as const, colorClass: "text-[#8B93A7]" },
];

export function BalanceHero({
  netBalancePaise,
  owedToYouPaise,
  youOwePaise,
  settledThisMonthPaise,
  userName,
}: BalanceHeroProps) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(getISTGreeting());
  }, []);

  const net = Number(netBalancePaise);
  const isPositive = net > 0;
  const isNegative = net < 0;
  const first = firstName(userName);

  const amounts = {
    owedToYou: owedToYouPaise,
    youOwe: youOwePaise,
    settled: settledThisMonthPaise,
  };

  return (
    <FadeIn>
      <section
        aria-labelledby="balance-heading"
        className="rounded-3xl border border-white/5 bg-[#161B22] shadow-card p-6 sm:p-8"
      >
        {/* Greeting — rendered only after mount to avoid hydration mismatch */}
        {greeting !== null && (
          <p className="text-sm font-semibold uppercase tracking-widest text-[#8B93A7]">
            {greeting}, {first.toUpperCase()}
          </p>
        )}

        {/* Balance */}
        <div className="mt-6">
          <p className="text-[13px] text-[#8B93A7]">Total Balance</p>
          <h2
            id="balance-heading"
            className="mt-1 text-[36px] sm:text-[52px] font-semibold leading-none tracking-tight text-[#F5F7FA] tabular-nums"
          >
            <AnimatedBalance targetPaise={Math.abs(net)} />
          </h2>
          <p className="mt-2 text-sm font-medium">
            {isPositive && <span className="text-[#00C896]">↑ You are owed</span>}
            {isNegative && <span className="text-[#FF4757]">↓ You owe</span>}
            {!isPositive && !isNegative && (
              <span className="text-[#8B93A7]">✓ All settled up</span>
            )}
          </p>
        </div>

        {/* Mini stat pills */}
        <StaggerChildren
          className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
          staggerDelay={0.08}
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-white/[0.03] px-4 py-3"
            >
              <p className="text-xs text-[#8B93A7]">{stat.label}</p>
              <p className={`mt-0.5 text-sm font-semibold tabular-nums ${stat.colorClass}`}>
                {formatPaise(amounts[stat.key])}
              </p>
            </div>
          ))}
        </StaggerChildren>
      </section>
    </FadeIn>
  );
}
