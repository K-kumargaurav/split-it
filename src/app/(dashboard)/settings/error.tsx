"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function SettingsPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <ErrorFallback error={error} reset={reset} title="Failed to load settings" />
    </div>
  );
}
