"use client";

import Link from "next/link";
import { useState } from "react";
import useSWRInfinite from "swr/infinite";

import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";

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

type Filter = "all" | "unread";

const fetcher = async (url: string): Promise<InboxPage> => {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return (await res.json()) as InboxPage;
};

export function NotificationsFeed(): JSX.Element {
  const [filter, setFilter] = useState<Filter>("all");

  const { data, size, setSize, mutate, isLoading, isValidating } =
    useSWRInfinite<InboxPage>(
      (index, prev) => {
        if (prev && !prev.nextCursor) return null;
        const params = new URLSearchParams({ limit: "20", filter });
        if (index > 0 && prev?.nextCursor) {
          params.set("cursor", prev.nextCursor);
        }
        return `/api/v1/users/me/notifications?${params.toString()}`;
      },
      fetcher,
      { revalidateOnFocus: false },
    );

  const pages = data ?? [];
  const items = pages.flatMap((p) => p.items);
  const lastPage = pages[pages.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const unread = pages[0]?.unreadCount ?? 0;

  async function markAllRead(): Promise<void> {
    const res = await fetch("/api/v1/users/me/notifications/read-all", {
      method: "PATCH",
    });
    if (res.ok) await mutate();
  }

  async function markOneRead(id: string): Promise<void> {
    await fetch(`/api/v1/users/me/notifications/${id}`, { method: "PATCH" });
    await mutate();
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter notifications" className="inline-flex rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 text-sm">
          <FilterTab
            label="All"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterTab
            label={`Unread${unread > 0 ? ` · ${unread}` : ""}`}
            active={filter === "unread"}
            onClick={() => setFilter("unread")}
          />
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unread === 0}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Mark all read
        </button>
      </div>

      {isLoading && items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading notifications…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {filter === "unread"
            ? "No unread notifications."
            : "You don't have any notifications yet."}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          {items.map((n, i) => (
            <li
              key={n.id}
              className={cn(
                "border-slate-100 dark:border-slate-800",
                i > 0 && "border-t",
              )}
            >
              <FeedRow item={n} onClick={() => void markOneRead(n.id)} />
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setSize(size + 1)}
            disabled={isValidating}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed"
          >
            {isValidating ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 transition",
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white",
      )}
    >
      {label}
    </button>
  );
}

function FeedRow({
  item,
  onClick,
}: {
  item: InboxItem;
  onClick: () => void;
}): JSX.Element {
  const href = entityHref(item);
  const inner = (
    <div
      className={cn(
        "flex items-start gap-3 px-5 py-4 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800",
        !item.isRead && "bg-indigo-50/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 inline-flex h-2 w-2 flex-shrink-0 rounded-full",
          item.isRead ? "bg-transparent" : "bg-indigo-600",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900 dark:text-white">{item.title}</p>
        <p className="mt-0.5 text-slate-600 dark:text-slate-300">{item.body}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-400">
          {formatRelativeTime(item.createdAt)}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={() => {
          if (!item.isRead) onClick();
        }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        if (!item.isRead) onClick();
      }}
      className="block w-full text-left"
    >
      {inner}
    </button>
  );
}

function entityHref(item: InboxItem): string | null {
  if (!item.entityType || !item.entityId) return null;
  switch (item.entityType) {
    case "GROUP":
      return `/groups/${item.entityId}`;
    case "EXPENSE":
      return null;
    case "SETTLEMENT":
      return null;
    default:
      return null;
  }
}
