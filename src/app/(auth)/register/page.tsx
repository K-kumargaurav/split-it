import Link from "next/link";

import { RegisterForm } from "@/components/forms/register-form";

const HIGHLIGHTS = [
  "Exact splits to the paise — no rounding errors",
  "Real-time settlements with full audit history",
  "Invite friends with guest links — no signup required",
];

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-slate-50 lg:grid-cols-2">
      <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-fuchsia-700 p-10 text-white lg:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18) 0px, transparent 40%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.12) 0px, transparent 35%)",
          }}
        />
        <Link href="/" className="relative z-10 inline-flex items-center gap-2 text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/30 backdrop-blur">
            S
          </span>
          SplitEasy
        </Link>
        <div className="relative z-10 max-w-md">
          <h2 className="text-balance text-3xl font-semibold leading-tight sm:text-4xl">
            Create an account. Settle up faster.
          </h2>
          <p className="mt-4 text-balance text-base leading-7 text-indigo-100">
            Track shared expenses, settle balances, and keep group history in one place.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-indigo-50">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-indigo-200">
          © {new Date().getFullYear()} SplitEasy. Money math, simplified.
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                S
              </span>
              SplitEasy
            </Link>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
              .
            </p>
          </header>

          <RegisterForm />

          <p className="mt-8 text-center text-xs text-slate-500">
            By continuing you agree to SplitEasy&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      </section>
    </main>
  );
}
