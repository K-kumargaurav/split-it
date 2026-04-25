"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { cn } from "@/lib/cn";

interface GoogleButtonProps {
  callbackUrl?: string;
  label?: string;
}

export function GoogleButton({
  callbackUrl = "/dashboard",
  label = "Continue with Google",
}: GoogleButtonProps) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setPending(true);
        signIn("google", { callbackUrl });
      }}
      disabled={pending}
      aria-label={label}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition",
        "hover:border-slate-300 hover:bg-slate-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.4-1.07 2.59-2.28 3.4v2.83h3.69c2.16-1.99 3.4-4.93 3.4-8.47z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.69-2.83c-1.02.69-2.34 1.1-4.24 1.1-3.26 0-6.02-2.2-7-5.16H1.18v3.24A11.99 11.99 0 0 0 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5 14.2a7.2 7.2 0 0 1 0-4.4V6.56H1.18a12 12 0 0 0 0 10.88L5 14.2z"
        />
        <path
          fill="#EA4335"
          d="M12 4.77c1.77 0 3.36.61 4.61 1.8l3.27-3.27C17.95 1.21 15.24 0 12 0 7.39 0 3.4 2.66 1.18 6.56L5 9.8c.98-2.96 3.74-5.03 7-5.03z"
        />
      </svg>
      {pending ? "Redirecting to Google…" : label}
    </button>
  );
}
