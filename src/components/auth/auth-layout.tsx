"use client";

import { m } from "framer-motion";

import { cn } from "@/lib/cn";

const FEATURE_PILLS = [
  "✓ Exact splits to the paise",
  "✓ UPI payments built-in",
  "✓ No account needed for guests",
];

const MOCK_CARDS = [
  { title: "Goa Trip", amount: "₹4,250", category: "Travel", members: "6 people" },
  { title: "Dinner — Toit", amount: "₹1,840", category: "Food", members: "4 people" },
  { title: "Netflix", amount: "₹649", category: "Subscription", members: "3 people" },
];

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen">
      <LeftPanel />
      <section className="flex w-full flex-col items-center justify-center bg-bg px-5 sm:px-8 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}

function LeftPanel() {
  return (
    <section
      aria-label="SplitEasy features"
      className="relative hidden flex-col items-center justify-center overflow-hidden bg-card bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:28px_28px] lg:flex lg:w-1/2"
    >
      <div className="relative z-10 flex flex-col items-center gap-6 px-12 text-center">
        {/* Logo mark */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          <span className="text-[22px] font-bold leading-none text-bg">₹</span>
        </div>

        {/* Brand name + tagline */}
        <div>
          <p className="text-[28px] font-bold leading-tight text-text-primary">SplitEasy</p>
          <p className="mt-1 text-base text-text-secondary">Split expenses. Not friendships.</p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-col gap-2">
          {FEATURE_PILLS.map((pill) => (
            <div
              key={pill}
              className="rounded-full border border-accent/20 bg-accent/[0.08] px-4 py-2 text-[13px] font-medium text-accent"
            >
              {pill}
            </div>
          ))}
        </div>

        {/* Floating mock expense cards */}
        <div className="relative mt-4 h-52 w-72">
          {MOCK_CARDS.map((card, i) => (
            <FloatingCard key={card.title} card={card} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface CardData {
  title: string;
  amount: string;
  category: string;
  members: string;
}

function FloatingCard({ card, index }: { card: CardData; index: number }) {
  return (
    <m.div
      animate={{ y: [0, -8, 0] }}
      transition={{
        duration: 3 + index * 0.3,
        repeat: Infinity,
        ease: "easeInOut",
        delay: index * 0.4,
      }}
      className={cn(
        "absolute rounded-2xl border border-border-dashed bg-bg/70 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-lg",
        index === 0 && "-rotate-2",
        index === 2 && "rotate-2",
      )}
      style={{
        width: "220px",
        top: `${index * 56}px`,
        left: `${index * 18}px`,
        zIndex: 3 - index,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{card.title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{card.members}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-accent">{card.amount}</span>
      </div>
      <div
        className="mt-2 inline-flex items-center rounded-full bg-accent-muted px-2 py-0.5 text-[11px] font-medium text-accent"
      >
        {card.category}
      </div>
    </m.div>
  );
}
