"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import useSWR from "swr";

import { cn } from "@/lib/cn";

interface NavbarProps {
  user: {
    displayName: string;
    handle: string;
    avatarUrl?: string;
  };
}

interface UnreadData {
  unreadCount: number;
}

const fetcher = async (url: string): Promise<UnreadData> => {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const json = (await res.json()) as { unreadCount: number };
  return { unreadCount: json.unreadCount ?? 0 };
};

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", match: (p: string) => p === "/dashboard" },
  { href: "/groups", label: "Groups", match: (p: string) => p.startsWith("/groups") },
  { href: "/notifications", label: "Notifications", match: (p: string) => p.startsWith("/notifications") },
] as const;

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname() ?? "";

  return (
    <header
      className="sticky top-0 z-50 h-[60px] border-b border-white/5 backdrop-blur-md"
      style={{ backgroundColor: "rgba(14,17,22,0.8)" }}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116] rounded-lg"
          aria-label="SplitEasy — go to dashboard"
        >
          <span
            aria-hidden="true"
            className="text-[20px] font-bold leading-none text-[#00C896]"
          >
            ₹
          </span>
          <span className="text-[16px] font-semibold text-[#F5F7FA]">SplitEasy</span>
        </Link>

        {/* Center nav — desktop only */}
        <nav aria-label="Primary" className="hidden md:flex md:items-center md:gap-1">
          {NAV_LINKS.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[60px] items-center border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none",
                  active
                    ? "border-[#00C896] text-[#F5F7FA]"
                    : "border-transparent text-[#8B93A7] hover:text-[#F5F7FA]",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <NavBell />
          <AvatarMenu user={user} />
        </div>
      </div>
    </header>
  );
}

// ── Notification bell ─────────────────────────────────────────────────────────

function NavBell() {
  const { data } = useSWR<UnreadData>(
    "/api/v1/users/me/notifications?limit=1",
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );
  const unread = data?.unreadCount ?? 0;

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications — ${unread} unread` : "Notifications"}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8B93A7] transition-colors hover:text-[#F5F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116]"
    >
      <Bell size={18} aria-hidden="true" />
      <AnimatePresence>
        {unread > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute -right-1 -top-1 inline-flex"
            aria-hidden="true"
          >
            <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-[#00C896]/60" />
            <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-[#00C896] text-[9px] font-semibold leading-none text-[#0E1116]">
              {unread > 9 ? "9+" : unread}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

// ── Avatar + dropdown ─────────────────────────────────────────────────────────

function AvatarMenu({ user }: { user: NavbarProps["user"] }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const initial = (user.displayName[0] ?? user.handle[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(ev: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116]"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-[#00C896] text-[13px] font-semibold text-[#0E1116]"
          >
            {initial}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="dropdown"
            role="menu"
            aria-label="Profile menu"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="absolute right-0 z-50 mt-2 w-52 origin-top-right overflow-hidden rounded-2xl border border-white/[0.08] bg-[#161B22] shadow-elevated"
          >
            {/* Handle */}
            <div className="border-b border-white/5 px-4 py-3">
              <p className="truncate text-xs text-[#8B93A7]">@{user.handle}</p>
            </div>

            {/* Menu items */}
            <ul className="py-1.5">
              <li>
                <DropdownLink href="/profile" onClick={() => setOpen(false)}>
                  Profile
                </DropdownLink>
              </li>
              <li>
                <DropdownLink href="/groups" onClick={() => setOpen(false)}>
                  Settings
                </DropdownLink>
              </li>
              <li className="mx-3 my-1.5 h-px bg-white/5" role="separator" aria-hidden="true" />
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    void signOut({ callbackUrl: "/login" });
                  }}
                  className="flex w-full items-center px-4 py-2 text-sm text-[#FF4757] transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
                >
                  Sign out
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropdownLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center px-4 py-2 text-sm text-[#F5F7FA] transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
