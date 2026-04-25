import Link from "next/link";

import { RegisterForm } from "@/components/forms/register-form";
import { Logo } from "@/components/ui/logo";

const PROOF_POINTS = [
  { stat: "₹0.00", label: "rounding errors — splits exact to the paise" },
  { stat: "1 tap", label: "to settle balances by UPI, cash, or bank" },
  { stat: "Guest links", label: "so friends pay without creating an account" },
];

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-slate-50 lg:grid-cols-[1.1fr_1fr]">
      <BrandSide />

      <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:py-16">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Already have one?{" "}
              <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
              .
            </p>
          </header>

          <RegisterForm />

          <p className="mt-8 text-center text-xs text-slate-500">
            By creating an account you agree to SplitEasy&apos;s{" "}
            <Link href="/terms" className="underline hover:text-slate-700">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-slate-700">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}

function BrandSide() {
  return (
    <section
      aria-label="SplitEasy"
      className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white lg:flex"
    >
      <div className="pointer-events-none absolute inset-0 -z-0 opacity-90">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-[420px] w-[420px] rounded-full bg-indigo-700/30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative z-10">
        <Logo variant="light" />
      </div>

      <div className="relative z-10 max-w-md">
        <p className="font-mono text-xs uppercase tracking-widest text-indigo-300">
          Built in India · Splits in INR
        </p>
        <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.1] tracking-tight">
          Trips, flatmates, dinners.
          <br />
          <span className="text-indigo-300">Always exact.</span>
        </h2>
        <p className="mt-5 max-w-sm text-balance text-base leading-7 text-slate-300">
          Pick a handle, invite friends, and track shared expenses to the paise. No spreadsheets,
          no rounding errors, no awkward reminders.
        </p>

        <dl className="mt-10 grid grid-cols-1 gap-4">
          {PROOF_POINTS.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
            >
              <dt className="font-mono text-xl font-semibold tracking-tight tabular-nums text-white">
                {item.stat}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-slate-300">{item.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="relative z-10 text-xs text-slate-500">
        © {new Date().getFullYear()} SplitEasy. Money math, simplified.
      </p>
    </section>
  );
}
