import Link from "next/link";

import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-800 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Enter the email associated with your account and we&apos;ll send you a link to choose
          a new password.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm />
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
