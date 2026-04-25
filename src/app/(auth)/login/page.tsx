import Link from "next/link";

import { LoginForm } from "@/components/forms/login-form";

interface LoginPageProps {
  searchParams: { callbackUrl?: string; error?: string };
}

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  EmailNotVerified:
    "Your email is not verified. Check your inbox for the verification link, or request a new one.",
  OAuthAccountNotLinked: "This email is already registered with a different sign-in method.",
  OAuthSignin: "Couldn't start the Google sign-in flow. Please try again.",
  OAuthCallback: "Google sign-in didn't complete. Please try again.",
  Configuration: "Authentication is misconfigured. Please contact support.",
  AccessDenied: "Access denied for this account.",
  Verification: "The sign-in link has expired or already been used.",
};

const HIGHLIGHTS = [
  "End-to-end exact splits — no rounding errors, ever",
  "Real-time settlements, audit logs, and group history",
  "Guest links so friends can pay without an account",
];

export default function LoginPage({ searchParams }: LoginPageProps) {
  const callbackUrl = searchParams.callbackUrl ?? "/dashboard";
  const errorMessage = searchParams.error
    ? ERROR_MESSAGES[searchParams.error] ?? "Sign-in failed. Please try again."
    : null;

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
            Welcome back. Settle up faster with friends.
          </h2>
          <p className="mt-4 text-balance text-base leading-7 text-indigo-100">
            Sign in to see your groups, track shared expenses to the paise, and clear balances in a single tap.
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
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Sign in to your account</h1>
            <p className="mt-2 text-sm text-slate-500">
              New here?{" "}
              <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                Create a free account
              </Link>
              .
            </p>
          </header>

          {errorMessage ? (
            <div
              role="alert"
              aria-live="polite"
              className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-8-3.75a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V7a.75.75 0 01.75-.75zm0 8a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              {errorMessage}
            </div>
          ) : null}

          <LoginForm callbackUrl={callbackUrl} />

          <p className="mt-8 text-center text-xs text-slate-500">
            By continuing you agree to SplitEasy&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      </section>
    </main>
  );
}
