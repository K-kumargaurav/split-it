"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

// Active-tab logic is URL-driven so the tab bar stays in sync with browser
// back/forward and refreshes. Expenses + Balances both live on the base
// `/groups/[id]` page (Balances jumps to the on-page section via #balances),
// while Recurring and Members are full route segments. Mobile rule: the row
// scrolls horizontally if the labels overflow.

interface GroupTabsProps {
  groupId: string;
}

type TabKey = "expenses" | "balances" | "recurring" | "members" | "audit";

export function GroupTabs({ groupId }: GroupTabsProps) {
  const pathname = usePathname() ?? "";
  const base = `/groups/${groupId}`;

  // Match by exact segment so `/groups/{id}/recurring/new` keeps "Recurring"
  // active without manual list maintenance.
  const segment = pathname.startsWith(`${base}/`)
    ? pathname.slice(base.length + 1).split("/")[0]
    : "";

  let active: TabKey = "expenses";
  if (segment === "recurring") active = "recurring";
  else if (segment === "members") active = "members";
  else if (segment === "audit") active = "audit";

  const tabs: { key: TabKey; label: string; href: string }[] = [
    { key: "expenses", label: "Expenses", href: base },
    { key: "balances", label: "Balances", href: `${base}#balances` },
    { key: "recurring", label: "Recurring", href: `${base}/recurring` },
    { key: "members", label: "Members", href: `${base}/members` },
    { key: "audit", label: "Audit", href: `${base}/audit` },
  ];

  const onBaseRoute = pathname === base || pathname === `${base}/`;

  return (
    <div
      role="tablist"
      aria-label="Group sections"
      className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <div className="inline-flex min-w-full gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const className = cn(
            "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            isActive
              ? "border-indigo-600 text-indigo-700 dark:text-indigo-300"
              : "border-transparent text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white",
          );

          // Balances is an in-page anchor on the base route. When the viewer is
          // already on the base route, use a plain <a href="#balances"> so the
          // browser handles the scroll natively — Next.js' <Link> can swallow
          // hash-only navigations that don't change the route.
          if (tab.key === "balances" && onBaseRoute) {
            return (
              <a
                key={tab.key}
                href="#balances"
                role="tab"
                aria-selected={isActive}
                className={className}
              >
                {tab.label}
              </a>
            );
          }

          return (
            <Link
              key={tab.key}
              href={tab.href}
              scroll
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={className}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
