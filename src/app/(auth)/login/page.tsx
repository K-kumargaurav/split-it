import Link from "next/link";

import { LoginForm } from "@/components/forms/login-form";
import { Logo } from "@/components/ui/logo";

interface LoginPageProps {
  searchParams: { callbackUrl?: string; error?: string };
}

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Incorrect password.",
  AccountNotFound: "No account found with this email. Create one?",
  EmailNotVerified:
    "Your email isn't verified. Check your inbox for the verification link, or request a new one.",
  OAuthSignin: "Couldn't start the Google sign-in flow. Please try again.",
  OAuthCallback: "Google sign-in didn't complete. Please try again.",
  Configuration: "Authentication is misconfigured. Please contact support.",
  AccessDenied: "Access denied for this account.",
  Verification: "The sign-in link has expired or already been used.",
};

const HIGHLIGHTS = [
  { stat: "₹0.00", label: "rounding errors — splits are exact to the paise" },
  { stat: "1 tap", label: "to settle balances by UPI, cash, or bank" },
  { stat: "Guest links", label: "so friends pay without creating an account" },
];

export default function LoginPage({ searchParams }: LoginPageProps) {
  const callbackUrl = searchParams.callbackUrl ?? "/dashboard";
  const errorMessage = searchParams.error
    ? ERROR_MESSAGES[searchParams.error] ?? "Sign-in failed. Please try again."
    : null;

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
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                Create one for free
              </Link>
              .
            </p>
          </header>

          {errorMessage ? (
            <div
              role="alert"
              aria-live="polite"
              className="mb-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
            >
              <ErrorDot />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <LoginForm callbackUrl={callbackUrl} />

          <p className="mt-8 text-center text-xs text-slate-500">
            By continuing you agree to SplitEasy&apos;s{" "}
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
      {/* Layered radial gradients give a subtle, premium glow without the
          generic SaaS rainbow. Stays mostly dark navy with indigo highlights. */}
      <div className="pointer-events-none absolute inset-0 -z-0 opacity-90">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-[420px] w-[420px] rounded-full bg-indigo-700/30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
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
          Settle up faster.
          <br />
          <span className="text-indigo-300">Argue less.</span>
        </h2>
        <p className="mt-5 max-w-sm text-balance text-base leading-7 text-slate-300">
          Track shared expenses to the paise across trips, flatmates, and dinners — and clear
          balances in a single tap.
        </p>

        <dl className="mt-10 grid grid-cols-1 gap-4">
          {HIGHLIGHTS.map((item) => (
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

function ErrorDot() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="mt-0.5 h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0zm-8-3.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V7a.75.75 0 0 1 .75-.75zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}
