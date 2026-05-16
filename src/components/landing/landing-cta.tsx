"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";

interface Props {
  isAuthed: boolean;
}

export function LandingCta({ isAuthed }: Props) {
  return (
    <section
      className="bg-bg px-6 py-24 sm:py-32"
      aria-labelledby="cta-heading"
    >
      <FadeIn>
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/5 bg-[linear-gradient(135deg,rgba(0,200,150,0.08),transparent)] px-8 py-16 text-center shadow-elevated">
          <p className="text-[12px] font-semibold text-accent uppercase tracking-widest mb-4">
            Get started today
          </p>
          <h2
            id="cta-heading"
            className="text-[32px] sm:text-[40px] font-bold text-text-primary tracking-[-0.02em] text-balance"
          >
            Ready to split smarter?
          </h2>
          <p className="mt-4 text-[16px] text-text-secondary">
            Free forever. No credit card needed.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <m.div whileTap={{ scale: 0.97 }}>
              <Link
                href={isAuthed ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 h-[52px] px-8 rounded-2xl bg-accent text-bg font-semibold text-[15px] transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Get started free
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </m.div>
            {!isAuthed && (
              <Link
                href="/login"
                className="text-[14px] text-text-secondary font-medium transition hover:text-text-primary"
              >
                Already have an account? Sign in
              </Link>
            )}
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
