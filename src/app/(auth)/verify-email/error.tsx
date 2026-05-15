"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function VerifyEmailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Email verification failed" />;
}
