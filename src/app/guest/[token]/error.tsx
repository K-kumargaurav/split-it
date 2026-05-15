"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function GuestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <ErrorFallback error={error} reset={reset} title="Failed to load guest view" />
    </main>
  );
}
