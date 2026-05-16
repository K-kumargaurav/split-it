"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { Plus } from "lucide-react";

interface FloatingAddButtonProps {
  href: string;
}

export function FloatingAddButton({ href }: FloatingAddButtonProps) {
  return (
    <div className="fixed bottom-24 right-4 z-50 sm:hidden">
      <m.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Link
          href={href}
          aria-label="Add expense"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00C896] text-[#0E1116] shadow-[0_8px_32px_rgba(0,200,150,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116]"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </m.div>
    </div>
  );
}
