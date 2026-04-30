import Link from "next/link";

import { ResendVerificationForm } from "@/components/forms/resend-verification-form";

interface PendingVerifyPageProps {
  searchParams: { email?: string };
}

export default function PendingVerifyPage({ searchParams }: PendingVerifyPageProps) {
  const email = typeof searchParams.email === "string" ? searchParams.email : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-800 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Resend verification email</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Enter the email you used to sign up. If your account is not yet verified, we&apos;ll
          send a new link.
        </p>
        <div className="mt-6">
          <ResendVerificationForm initialEmail={email} />
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
