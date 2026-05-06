"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, LayoutDashboard, User, Users, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

interface Tab {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  Icon: LucideIcon;
}

const TABS: Tab[] = [
  {
    href: "/dashboard",
    label: "Home",
    match: (p) => p === "/dashboard",
    Icon: LayoutDashboard,
  },
  {
    href: "/groups",
    label: "Groups",
    match: (p) => p.startsWith("/groups"),
    Icon: Users,
  },
  {
    href: "/notifications",
    label: "Notifications",
    match: (p) => p.startsWith("/notifications"),
    Icon: Bell,
  },
  {
    href: "/profile",
    label: "Profile",
    match: (p) => p.startsWith("/profile"),
    Icon: User,
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Primary mobile navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-white/5 backdrop-blur-xl md:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
      style={{ backgroundColor: "rgba(14,17,22,0.95)" }}
    >
      <ul className="grid h-16 grid-cols-4">
        {TABS.map(({ href, label, match, Icon }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <motion.div whileTap={{ scale: 0.9 }} transition={{ duration: 0.12 }}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex h-16 flex-col items-center justify-center gap-1 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-xl px-3 py-1 transition-colors",
                      active ? "bg-[rgba(0,200,150,0.1)]" : "",
                    )}
                  >
                    <Icon
                      size={22}
                      className={active ? "text-[#00C896]" : "text-[#8B93A7]"}
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium leading-none",
                      active ? "text-[#00C896]" : "text-[#8B93A7]",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              </motion.div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
