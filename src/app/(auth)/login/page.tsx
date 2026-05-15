import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/forms/login-form";

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

export default function LoginPage({ searchParams }: LoginPageProps) {
  const callbackUrl = searchParams.callbackUrl ?? "/dashboard";
  const errorMessage = searchParams.error
    ? (ERROR_MESSAGES[searchParams.error] ?? "Sign-in failed. Please try again.")
    : null;

  return (
    <AuthLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-[28px] font-bold leading-tight text-text-primary">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-accent hover:opacity-80 transition-opacity"
            >
              Create one for free.
            </Link>
          </p>
        </header>

        {errorMessage ? (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-2xl border border-error/20 bg-error/[0.08] px-4 py-3 text-sm text-error"
          >
            <ErrorIcon />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <LoginForm callbackUrl={callbackUrl} />

        <p className="text-center text-xs text-text-secondary">
          By continuing you agree to SplitEasy&apos;s{" "}
          <Link href="/terms" className="underline hover:text-text-primary transition-colors">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-text-primary transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </AuthLayout>
  );
}

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="mt-0.5 h-4 w-4 shrink-0"
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
