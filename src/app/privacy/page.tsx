import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SplitEasy",
};

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[#8B949E]">Last updated: May 2026</p>

        <div className="mt-8 space-y-5 text-[#C9D1D9] leading-relaxed">
          <section>
            <h2 className="mb-2 text-base font-semibold text-[#F5F7FA]">1. Data We Collect</h2>
            <p>
              We collect your email address (and optionally your name and profile picture) when
              you create an account. We also store the expense and group data you enter into the
              app.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[#F5F7FA]">2. How We Use Your Data</h2>
            <p>
              Your data is used solely to operate the SplitEasy service — to show you your
              balances, send authentication emails, and notify your group members of activity.
              We do not sell your data to third parties.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[#F5F7FA]">3. Third-Party Services</h2>
            <p>
              We use Supabase (database and file storage), Brevo (transactional email), and
              Google OAuth (sign-in). Each service operates under its own privacy policy.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[#F5F7FA]">4. Data Retention</h2>
            <p>
              Your account data is retained until you delete your account. Expense and
              settlement history is anonymised on account deletion; it is not hard-deleted so
              that other group members retain accurate records.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[#F5F7FA]">5. Contact</h2>
            <p>
              For privacy questions or data-deletion requests, email{" "}
              <a
                href="mailto:hello@spliteasy.info"
                className="underline transition-colors hover:text-[#F5F7FA]"
              >
                hello@spliteasy.info
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
