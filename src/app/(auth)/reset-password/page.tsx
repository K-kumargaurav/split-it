import Link from "next/link";

import { ResetPasswordForm } from "@/components/forms/reset-password-form";

interface ResetPasswordPageProps {
  searchParams: { token?: string };
}

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-800 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Choose a new password</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Enter a new password below. After resetting, you can sign in immediately.
        </p>
        <div className="mt-6">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4">
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                The link is missing a token. Request a new password-reset email.
              </div>
              <Link
                href="/forgot-password"
                className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Request a reset link
              </Link>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
