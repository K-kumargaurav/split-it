"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

// Fixed bottom tab bar shown only on small viewports (< sm). Mirrors the
// primary navigation surfaced in the desktop topbar so a thumb can always
// reach the four key destinations. Active state is derived from the URL so
// the active tab survives a refresh.
//
// We hide on `sm:` and above — desktop keeps the full navbar.

interface Tab {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: () => JSX.Element;
}

const TABS: Tab[] = [
  {
    href: "/dashboard",
    label: "Home",
    match: (p) => p === "/dashboard",
    icon: () => <HomeIcon />,
  },
  {
    href: "/groups",
    label: "Groups",
    match: (p) => p.startsWith("/groups"),
    icon: () => <GroupsIcon />,
  },
  {
    href: "/notifications",
    label: "Inbox",
    match: (p) => p.startsWith("/notifications"),
    icon: () => <BellIcon />,
  },
  {
    href: "/profile",
    label: "Profile",
    match: (p) => p.startsWith("/profile"),
    icon: () => <UserIcon />,
  },
];

export function MobileBottomNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur sm:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition active:scale-95",
                  active
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <span aria-hidden="true">{tab.icon()}</span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3H9v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7z" />
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 15.5A4.5 4.5 0 0 1 6.5 11h1A4.5 4.5 0 0 1 12 15.5v.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-.5zm12-1V16a2 2 0 0 1-.18.83A2 2 0 0 1 14 17h3a1 1 0 0 0 1-1v-.5A3.5 3.5 0 0 0 14.5 12h-1c-.31 0-.61.04-.9.11A5.49 5.49 0 0 1 14 14.5z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M10 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-7 8.5a7 7 0 0 1 14 0v.25a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75V17.5z" />
    </svg>
  );
}
