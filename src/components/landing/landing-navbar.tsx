
"use client";

import { useState } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

interface Props {
  isAuthed: boolean;
}

export function LandingNavbar({ isAuthed }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-bg/80 backdrop-blur-xl">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-6 h-16"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold text-text-primary"
          aria-label="SplitEasy home"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-bg font-bold text-sm"
          >
            ₹
          </span>
          <span className="text-base tracking-[-0.02em]">SplitEasy</span>
        </Link>

        {/* Desktop */}
        <div className="hidden sm:flex items-center gap-3">
          {isAuthed ? (
            <m.div whileTap={{ scale: 0.97 }}>
              <Link
                href="/dashboard"
                className="h-10 px-4 rounded-button bg-accent text-bg font-semibold text-sm flex items-center transition hover:bg-accent/90"
              >
                Dashboard
              </Link>
            </m.div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-text-secondary text-sm font-medium transition hover:text-text-primary px-3 py-2"
              >
                Sign in
              </Link>
              <m.div whileTap={{ scale: 0.97 }}>
                <Link
                  href="/register"
                  className="h-10 px-4 rounded-button bg-accent text-bg font-semibold text-sm flex items-center transition hover:bg-accent/90"
                >
                  Get started free
                </Link>
              </m.div>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-text-secondary p-2 hover:text-text-primary transition"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <m.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="sm:hidden border-t border-white/5 px-6 py-4 flex flex-col gap-3 overflow-hidden"
          >
            {isAuthed ? (
              <Link
                href="/dashboard"
                className="w-full h-12 rounded-button bg-accent text-bg font-semibold text-sm flex items-center justify-center"
                onClick={() => setOpen(false)}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-text-secondary text-sm font-medium py-2 text-center"
                  onClick={() => setOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="w-full h-12 rounded-button bg-accent text-bg font-semibold text-sm flex items-center justify-center"
                  onClick={() => setOpen(false)}
                >
                  Get started free
                </Link>
              </>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
