"use client";

import { FadeIn, StaggerChildren } from "@/components/ui/motion";

const STEPS = [
  {
    number: "01",
    title: "Create a group",
    desc: "Add your friends, flatmates, or travel buddies.",
  },
  {
    number: "02",
    title: "Add expenses",
    desc: "Split equally, by exact amount, or percentage.",
  },
  {
    number: "03",
    title: "Settle via UPI",
    desc: "One tap to generate a UPI payment link.",
  },
];

function Step({
  number,
  title,
  desc,
  isLast,
}: {
  number: string;
  title: string;
  desc: string;
  isLast: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center text-center sm:items-start sm:text-left">
      {/* Connector line (desktop only, between steps) */}
      {!isLast && (
        <div
          aria-hidden="true"
          className="absolute top-6 hidden h-px w-[calc(100%-48px)] bg-gradient-to-r from-white/10 to-transparent lg:block"
          style={{ left: "calc(50% + 24px)" }}
        />
      )}

      <span
        className="text-[36px] sm:text-[48px] font-bold text-accent tracking-[-0.03em] leading-none"
        aria-hidden="true"
      >
        {number}
      </span>
      <h3 className="mt-3 text-[18px] font-semibold text-text-primary tracking-[-0.01em]">
        {title}
      </h3>
      <p className="mt-2 text-[14px] text-text-secondary leading-relaxed max-w-[220px] mx-auto sm:mx-0">
        {desc}
      </p>
    </div>
  );
}

export function LandingHow() {
  return (
    <section
      id="how-it-works"
      className="bg-bg px-6 py-24 sm:py-32"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-16">
          <p className="text-[12px] font-semibold text-accent uppercase tracking-widest mb-3">
            How it works
          </p>
          <h2
            id="how-heading"
            className="text-[32px] sm:text-[36px] font-bold text-text-primary tracking-[-0.02em]"
          >
            Three steps to zero drama
          </h2>
        </FadeIn>

        <StaggerChildren className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8 relative">
          {STEPS.map((step, i) => (
            <Step key={step.number} {...step} isLast={i === STEPS.length - 1} />
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
