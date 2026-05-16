"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

interface ProfileMenuProps {
  displayName: string | null;
  handle: string;
  email: string | null;
  image: string | null;
}

// Avatar button + dropdown for the dashboard header. Holds the secondary
// account actions (View profile / Settings / Sign out) so the topbar can stay
// uncluttered, especially on mobile. Click-outside + Escape close the menu.
export function ProfileMenu({ displayName, handle, email, image }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const initial = (displayName?.[0] ?? handle[0] ?? "?").toUpperCase();

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
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-card py-1 pl-1 pr-1 text-sm text-text-primary transition sm:pr-3",
          "hover:border-white/10 hover:bg-surface-hover",
          "active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        )}
      >
        <Avatar image={image} initial={initial} />
        <span className="hidden font-medium sm:inline">@{handle}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Profile menu"
          className="absolute right-0 z-30 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-white/5 bg-card shadow-elevated"
        >
          <header className="border-b border-white/[0.05] px-4 py-3">
            <p className="truncate text-sm font-semibold text-text-primary">
              {displayName ?? `@${handle}`}
            </p>
            {email ? (
              <p className="mt-0.5 truncate text-[12px] text-text-secondary">{email}</p>
            ) : (
              <p className="mt-0.5 truncate text-[12px] text-text-secondary">@{handle}</p>
            )}
          </header>
          <ul className="py-1.5 text-sm">
            <li>
              <MenuLink href="/profile" onClick={() => setOpen(false)}>
                <UserIcon /> View profile
              </MenuLink>
            </li>
            <li>
              <MenuLink href="/settings" onClick={() => setOpen(false)}>
                <CogIcon /> Settings
              </MenuLink>
            </li>
            <li className="border-t border-white/[0.05] mt-1 pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void signOut({ callbackUrl: "/login" });
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-4 py-2 text-left text-error",
                  "hover:bg-error/5",
                  "focus-visible:outline-none focus-visible:bg-error/5",
                )}
              >
                <LogOutIcon /> Sign out
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
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
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-text-secondary transition",
        "hover:bg-surface-hover hover:text-text-primary",
        "focus-visible:outline-none focus-visible:bg-surface-hover focus-visible:text-text-primary",
      )}
    >
      {children}
    </Link>
  );
}

function Avatar({ image, initial }: { image: string | null; initial: string }) {
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 rounded-full object-cover ring-1 ring-white/10"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent"
    >
      {initial}
    </span>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-text-secondary" fill="currentColor" aria-hidden="true">
      <path d="M10 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-7 8.5a7 7 0 0 1 14 0v.25a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75V17.5z" />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-text-secondary" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M11.49 3.17a.75.75 0 0 0-1.48-.34l-.27 1.21A6.97 6.97 0 0 0 7.4 5.06l-1.18-.4a.75.75 0 0 0-.85.27l-.86 1.18a.75.75 0 0 0 .12.99l.94.83A6.94 6.94 0 0 0 5.55 10c0 .35.03.69.07 1.02l-.94.83a.75.75 0 0 0-.12.99l.86 1.18a.75.75 0 0 0 .85.27l1.18-.4a6.97 6.97 0 0 0 2.34 1.02l.27 1.21a.75.75 0 0 0 1.48-.34l-.21-1.23a6.97 6.97 0 0 0 2.4-1.02l1.18.4a.75.75 0 0 0 .85-.27l.86-1.18a.75.75 0 0 0-.12-.99l-.94-.83c.04-.33.07-.67.07-1.02s-.03-.69-.07-1.02l.94-.83a.75.75 0 0 0 .12-.99l-.86-1.18a.75.75 0 0 0-.85-.27l-1.18.4a6.97 6.97 0 0 0-2.4-1.02l-.21-1.23zM10 12.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-error" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M3 4.75A1.75 1.75 0 0 1 4.75 3h5.5a.75.75 0 0 1 0 1.5h-5.5a.25.25 0 0 0-.25.25v10.5c0 .14.11.25.25.25h5.5a.75.75 0 0 1 0 1.5h-5.5A1.75 1.75 0 0 1 3 15.25V4.75zM12.97 6.47a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 0 1-1.06-1.06l1.72-1.72H8a.75.75 0 0 1 0-1.5h6.69l-1.72-1.72a.75.75 0 0 1 0-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
