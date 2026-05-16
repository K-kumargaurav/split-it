"use client";

import { Suspense } from "react";
import { AnimatePresence, m } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";

function GroupLayoutClientInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "";

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={`${pathname}?${tab}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

export function GroupLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <GroupLayoutClientInner>{children}</GroupLayoutClientInner>
    </Suspense>
  );
}
