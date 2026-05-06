"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { cn } from "@/lib/cn";

export type GroupTabKey = "expenses" | "balances" | "recurring" | "members" | "audit";

interface GroupTabNavProps {
  groupId: string;
  activeTab: GroupTabKey;
}

const TABS: { key: GroupTabKey; label: string }[] = [
  { key: "expenses", label: "Expenses" },
  { key: "balances", label: "Balances" },
  { key: "recurring", label: "Recurring" },
  { key: "members", label: "Members" },
  { key: "audit", label: "Audit" },
];

export function GroupTabNav({ groupId, activeTab }: GroupTabNavProps) {
  const base = `/groups/${groupId}`;

  function getHref(key: GroupTabKey): string {
    if (key === "expenses") return base;
    if (key === "balances") return `${base}?tab=balances`;
    return `${base}/${key}`;
  }

  return (
    <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div
        role="tablist"
        aria-label="Group sections"
        className="inline-flex min-w-full rounded-2xl bg-[#161B22] p-1"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={getHref(tab.key)}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896]",
                isActive ? "text-[#00C896]" : "text-[#8B93A7] hover:text-[#F5F7FA]",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="group-tab-indicator"
                  className="absolute inset-0 rounded-xl bg-[#00C896]/10"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
