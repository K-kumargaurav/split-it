"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";

// Bell icon in the dashboard header. Polls /users/me/notifications every
// 30s for the latest unread count + first page. Click opens a dropdown
// with the latest 10 entries; "Mark all as read" hits the bulk endpoint.
//
// Per CLAUDE.md UI rules: keyboard-navigable button + WCAG aria labels;
// loading state via SWR's revalidating flag; mobile-first layout.

interface InboxItem {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface InboxPage {
  items: InboxItem[];
  unreadCount: number;
  nextCursor: string | null;
}

const POLL_INTERVAL_MS = 30_000;

const fetcher = async (url: string): Promise<InboxPage> => {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return (await res.json()) as InboxPage;
};

export function NotificationBell(): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const { data, mutate, isLoading } = useSWR<InboxPage>(
    "/api/v1/users/me/notifications?limit=10",
    fetcher,
    { refreshInterval: POLL_INTERVAL_MS, revalidateOnFocus: true },
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(ev: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(ev.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  async function markAllRead(): Promise<void> {
    const res = await fetch("/api/v1/users/me/notifications/read-all", {
      method: "PATCH",
    });
    if (res.ok) {
      await mutate();
    }
  }

  async function markOneRead(id: string): Promise<void> {
    await fetch(`/api/v1/users/me/notifications/${id}`, { method: "PATCH" });
    await mutate();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.06] bg-card text-text-secondary transition",
          "hover:border-white/10 hover:bg-surface-hover hover:text-text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        )}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className="absolute -right-1 -top-1 inline-flex">
            <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-accent/60" />
            <span className="relative inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-[#0E1116]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/5 bg-card shadow-elevated"
        >
          <header className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
            <span className="text-sm font-semibold text-text-primary">
              Notifications
            </span>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-[12px] font-medium text-accent hover:opacity-80 disabled:cursor-not-allowed disabled:text-text-secondary disabled:opacity-50"
            >
              Mark all read
            </button>
          </header>

          <ul className="max-h-96 divide-y divide-white/[0.04] overflow-y-auto">
            {isLoading && items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-text-secondary">
                Loading...
              </li>
            ) : items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-text-secondary">
                You&apos;re all caught up.
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <NotificationRow
                    item={n}
                    onClick={() => {
                      if (!n.isRead) void markOneRead(n.id);
                      setOpen(false);
                    }}
                  />
                </li>
              ))
            )}
          </ul>

          <footer className="border-t border-white/[0.05] px-4 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-[12px] font-medium text-accent hover:opacity-80"
            >
              View all
            </Link>
          </footer>
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({
  item,
  onClick,
}: {
  item: InboxItem;
  onClick: () => void;
}): JSX.Element {
  const href = entityHref(item);

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 text-sm transition hover:bg-surface-hover",
        !item.isRead && "bg-accent/[0.04]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full",
          item.isRead ? "bg-transparent" : "bg-accent",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-text-primary">{item.title}</p>
        <p className="mt-0.5 truncate text-text-secondary">{item.body}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wider text-text-secondary">
          {formatRelativeTime(item.createdAt)}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className="block">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
}

function entityHref(item: InboxItem): string | null {
  if (!item.entityType || !item.entityId) return null;
  switch (item.entityType) {
    case "GROUP":
      return `/groups/${item.entityId}`;
    default:
      return null;
  }
}

function BellIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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
