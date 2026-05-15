"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}

export function ErrorFallback({ error, reset, title = "Something went wrong" }: ErrorFallbackProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center" role="alert">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-6 w-6 text-red-400" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-text-secondary">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 flex h-10 items-center gap-2 rounded-2xl bg-white/10 px-5 text-sm font-medium text-text-primary transition-colors hover:bg-white/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <RotateCcw size={14} aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
