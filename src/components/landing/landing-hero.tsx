"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Users } from "lucide-react";

interface Props {
  isAuthed: boolean;
}

const MOCK_GROUPS = [
  { name: "Goa Trip 🏖️", members: 4, balance: "+₹1,200", positive: true },
  { name: "Flat Expenses 🏠", members: 3, balance: "-₹800", positive: false },
  { name: "Office Lunch 🍕", members: 6, balance: "+₹400", positive: true },
];

const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE_OUT },
});

export function LandingHero({ isAuthed }: Props) {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-6 pb-24 pt-12">
      {/* Animated gradient orb */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="h-[700px] w-[700px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,200,150,0.08)_0%,transparent_70%)]" />
      </motion.div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto w-full">
        {/* Pill badge */}
        <motion.div {...fadeUp(0)}>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[12px] font-medium text-accent"
            aria-label="India's first UPI-native bill splitter"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            India&apos;s first UPI-native bill splitter
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          className="mt-6 font-bold tracking-[-0.03em] text-text-primary text-[40px] sm:text-[56px] lg:text-[72px] leading-[1.05]"
          {...fadeUp(0.1)}
        >
          Split expenses.
          <br />
          Not friendships.
        </motion.h1>

        {/* Subheading */}
        <motion.p
          className="mt-5 max-w-xl text-text-secondary text-[18px] leading-relaxed text-center"
          {...fadeUp(0.2)}
        >
          Track shared expenses with friends, flatmates, and travel companions.
          Settle instantly via UPI.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="mt-8 flex flex-col sm:flex-row items-center gap-3"
          {...fadeUp(0.3)}
        >
          <motion.div whileTap={{ scale: 0.97 }}>
            <Link
              href={isAuthed ? "/dashboard" : "/register"}
              className="inline-flex items-center gap-2 h-[52px] px-7 rounded-2xl bg-accent text-bg font-semibold text-[15px] transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Get started free
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }}>
            <Link
              href="#how-it-works"
              className="inline-flex items-center h-[52px] px-7 rounded-2xl border border-white/10 text-text-primary font-semibold text-[15px] transition hover:border-white/20 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              See how it works
            </Link>
          </motion.div>
        </motion.div>

        {/* Floating mock dashboard */}
        <motion.div
          className="mt-14 w-full max-w-sm mx-auto"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: EASE_OUT }}
          aria-hidden="true"
        >
          <motion.div
            initial={{ rotate: -1 }}
            animate={{ y: [-4, 4, -4], rotate: -1 }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="rounded-3xl bg-card border border-white/5 shadow-elevated p-5 text-left">
              {/* Balance header */}
              <p className="text-text-secondary text-[11px] font-medium uppercase tracking-wider mb-1">
                Total balance
              </p>
              <p className="text-accent text-2xl font-bold tracking-[-0.02em]">
                You&apos;re owed ₹3,400
              </p>

              {/* Group cards */}
              <div className="mt-4 flex flex-col gap-2">
                {MOCK_GROUPS.map((g) => (
                  <div
                    key={g.name}
                    className="flex items-center justify-between rounded-xl bg-bg p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">
                        <Users size={13} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-text-primary text-[12px] font-medium">{g.name}</p>
                        <p className="text-text-secondary text-[10px]">{g.members} members</p>
                      </div>
                    </div>
                    <span
                      className={`text-[12px] font-semibold ${g.positive ? "text-accent" : "text-error"}`}
                    >
                      {g.balance}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
