import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5 bg-card">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div className="flex flex-col items-center gap-1.5 sm:items-start">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-bg font-bold text-xs"
              >
                ₹
              </span>
              <span className="text-[15px] font-semibold text-text-primary tracking-[-0.02em]">
                SplitEasy
              </span>
            </div>
            <p className="text-[13px] text-text-secondary">Split bills, not friendships.</p>
          </div>

          {/* Links */}
          <nav aria-label="Footer navigation">
            <ul className="flex items-center gap-5 text-[13px] text-text-secondary">
              <li>
                <Link href="/privacy" className="transition hover:text-text-primary">
                  Privacy Policy
                </Link>
              </li>
              <li aria-hidden="true" className="select-none">
                ·
              </li>
              <li>
                <Link href="/terms" className="transition hover:text-text-primary">
                  Terms
                </Link>
              </li>
              <li aria-hidden="true" className="select-none">
                ·
              </li>
              <li>
                <Link href="mailto:hello@spliteasy.info" className="transition hover:text-text-primary">
                  Contact
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t border-white/5 pt-6 text-center text-[12px] text-text-secondary">
          <p>© {new Date().getFullYear()} SplitEasy. Made with ♥ in India.</p>
        </div>
      </div>
    </footer>
  );
}
