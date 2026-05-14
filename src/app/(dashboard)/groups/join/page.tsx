import { Suspense } from "react";

import JoinGroupContent from "./join-content";

export default function JoinGroupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0E1116]">
          <p className="text-sm text-[#8B949E]">Loading…</p>
        </div>
      }
    >
      <JoinGroupContent />
    </Suspense>
  );
}
