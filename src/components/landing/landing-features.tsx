"use client";

import { Calculator, Smartphone, Link2, RefreshCw, Camera, Shield } from "lucide-react";
import { FadeIn, StaggerChildren } from "@/components/ui/motion";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: Calculator,
    title: "Exact to the paise",
    desc: "Zero rounding errors. Every rupee tracked.",
  },
  {
    icon: Smartphone,
    title: "UPI in one tap",
    desc: "Generate UPI payment links instantly.",
  },
  {
    icon: Link2,
    title: "Guest links",
    desc: "Friends pay without creating an account.",
  },
  {
    icon: RefreshCw,
    title: "Recurring splits",
    desc: "Automate rent, OTT, and monthly bills.",
  },
  {
    icon: Camera,
    title: "Receipt OCR",
    desc: "Scan receipts to auto-fill expenses.",
  },
  {
    icon: Shield,
    title: "Full audit trail",
    desc: "Every change logged. Total transparency.",
  },
];

function FeatureCard({ icon: Icon, title, desc }: Feature) {
  return (
    <div
      className="rounded-card bg-card border border-white/5 p-6 shadow-card transition-colors hover:border-white/10"
      role="article"
    >
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10"
        aria-hidden="true"
      >
        <Icon size={20} className="text-accent" />
      </div>
      <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-[13px] text-text-secondary leading-relaxed">{desc}</p>
    </div>
  );
}

export function LandingFeatures() {
  return (
    <section className="bg-bg px-6 py-24 sm:py-32" aria-labelledby="features-heading">
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-16">
          <h2
            id="features-heading"
            className="text-[32px] sm:text-[36px] font-bold text-text-primary tracking-[-0.02em]"
          >
            Everything you need to split fairly
          </h2>
        </FadeIn>

        <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
