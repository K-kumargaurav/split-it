import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — SplitEasy",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0E1116] px-4 py-12 text-[#F5F7FA]">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[#8B949E] transition-colors hover:text-[#F5F7FA]"
          aria-label="Back to login"
        >
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9.78 3.97a.75.75 0 0 1 0 1.06L7.06 7.75l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.28a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </Link>

        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-[#8B949E]">Last updated: May 2026</p>

        <div className="mt-8 space-y-5 text-[#C9D1D9] leading-relaxed">
          <section>
            <h2 className="mb-2 text-base font-semibold text-[#F5F7FA]">1. Acceptance</h2>
            <p>
              By accessing or using SplitEasy you agree to be bound by these Terms. If you do
              not agree, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[#F5F7FA]">2. Description of Service</h2>
            <p>
              SplitEasy is a ledger and expense-coordination tool. No money moves through the
              platform — you are responsible for settling debts through external payment methods
              (UPI, bank transfer, cash, etc.).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[#F5F7FA]">3. User Responsibilities</h2>
            <p>
              You agree to provide accurate information, keep your account credentials secure,
              and use the service only for lawful purposes. You are solely responsible for the
              accuracy of expenses you add.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[#F5F7FA]">4. Limitation of Liability</h2>
            <p>
              SplitEasy is provided &quot;as is&quot; without warranties of any kind. We are not liable
              for any financial disputes between users or for any loss of data.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[#F5F7FA]">5. Changes</h2>
            <p>
              We may update these Terms from time to time. Continued use after changes constitutes
              acceptance of the revised Terms.
            </p>
          </section>

          <p className="pt-2 text-sm">
            Questions?{" "}
            <a
              href="mailto:hello@spliteasy.info"
              className="underline transition-colors hover:text-[#F5F7FA]"
            >
              hello@spliteasy.info
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
