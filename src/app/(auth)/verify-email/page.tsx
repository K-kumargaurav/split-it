import Link from "next/link";

import { verifyEmailAction } from "@/server/auth/verify-email";

interface VerifyEmailPageProps {
  searchParams: { token?: string };
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const token = searchParams.token;
  const result = token
    ? await verifyEmailAction({ token })
    : ({ ok: false, reason: "invalid" as const });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-800 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        {result.ok ? <SuccessPanel /> : <FailurePanel />}
      </div>
    </main>
  );
}

function SuccessPanel() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-emerald-600" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">Email verified</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Your email address has been confirmed. You can now sign in.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Continue to sign in
      </Link>
    </div>
  );
}

function FailurePanel() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-red-600" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-8-3.75a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V7a.75.75 0 01.75-.75zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">Link is invalid or expired</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        This verification link is no longer valid. Request a fresh one and we&apos;ll send a new link.
      </p>
      <Link
        href="/verify-email/pending"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Request a new link
      </Link>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Or{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          back to sign in
        </Link>
        .
      </p>
    </div>
  );
}
