"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function JoinGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Failed to join group" />;
}
