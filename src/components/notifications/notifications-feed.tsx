"use client";

import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import useSWRInfinite from "swr/infinite";

import { cn } from "@/lib/cn";
import { NotificationItem } from "./notification-item";
import { EmptyNotifications } from "./empty-notifications";
import { NotificationSkeleton } from "@/components/ui/skeleton";

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

type ApiFilter = "all" | "unread";
type ViewFilter = "all" | "unread" | "expenses" | "settlements";

interface TabDef {
  key: ViewFilter;
  label: string;
}

const TABS: TabDef[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "expenses", label: "Expenses" },
  { key: "settlements", label: "Settlements" },
];

const fetcher = async (url: string): Promise<InboxPage> => {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return (await res.json()) as InboxPage;
};

function toApiFilter(view: ViewFilter): ApiFilter {
  return view === "unread" ? "unread" : "all";
}

function applyViewFilter(items: InboxItem[], view: ViewFilter): InboxItem[] {
  if (view === "expenses") return items.filter((i) => i.type.includes("EXPENSE"));
  if (view === "settlements") return items.filter((i) => i.type.includes("SETTLEMENT"));
  return items;
}

const IST_DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getDateGroup(dateStr: string): "Today" | "Yesterday" | "Earlier" {
  const now = new Date();
  const today = IST_DATE_FMT.format(now);

  const yd = new Date(now);
  yd.setDate(yd.getDate() - 1);
  const yesterday = IST_DATE_FMT.format(yd);

  const itemFmt = IST_DATE_FMT.format(new Date(dateStr));
  if (itemFmt === today) return "Today";
  if (itemFmt === yesterday) return "Yesterday";
  return "Earlier";
}

type DateLabel = "Today" | "Yesterday" | "Earlier";
const DATE_ORDER: DateLabel[] = ["Today", "Yesterday", "Earlier"];

interface DateGroup {
  label: DateLabel;
  items: InboxItem[];
}

function groupByDate(items: InboxItem[]): DateGroup[] {
  const map = new Map<DateLabel, InboxItem[]>();
  for (const item of items) {
    const label = getDateGroup(item.createdAt);
    const bucket = map.get(label) ?? [];
    bucket.push(item);
    map.set(label, bucket);
  }
  return DATE_ORDER.filter((l) => map.has(l)).map((label) => ({
    label,
    items: map.get(label)!,
  }));
}

export function NotificationsFeed(): JSX.Element {
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const apiFilter = toApiFilter(viewFilter);

  const { data, size, setSize, mutate, isLoading, isValidating } =
    useSWRInfinite<InboxPage>(
      (index, prev) => {
        if (prev && !prev.nextCursor) return null;
        const params = new URLSearchParams({ limit: "20", filter: apiFilter });
        if (index > 0 && prev?.nextCursor) {
          params.set("cursor", prev.nextCursor);
        }
        return `/api/v1/users/me/notifications?${params.toString()}`;
      },
      fetcher,
      { revalidateOnFocus: false },
    );

  const pages = data ?? [];
  const allItems = pages.flatMap((p) => p.items);
  const visibleItems = applyViewFilter(allItems, viewFilter);
  const lastPage = pages[pages.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const unread = pages[0]?.unreadCount ?? 0;
  const grouped = groupByDate(visibleItems);

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
      {/* ── Toolbar: filter tabs + mark-all ──────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter notifications"
          className="inline-flex rounded-2xl bg-[#161B22] p-1"
        >
          {TABS.map((tab) => {
            const isActive = viewFilter === tab.key;
            const label =
              tab.key === "unread" && unread > 0
                ? `Unread · ${unread}`
                : tab.label;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setViewFilter(tab.key)}
                className={cn(
                  "relative whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896]",
                  isActive
                    ? "text-[#00C896]"
                    : "text-[#8B93A7] hover:text-[#F5F7FA]",
                )}
              >
                {isActive && (
                  <m.span
                    layoutId="notif-tab-indicator"
                    className="absolute inset-0 rounded-xl bg-[#00C896]/10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>

        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-[13px] font-medium text-[#00C896] transition-opacity hover:opacity-75"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {isLoading && visibleItems.length === 0 ? (
        <div className="flex flex-col gap-1">
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyNotifications />
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {grouped.map(({ label, items }) => (
              <div key={label}>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-[#8B93A7]">
                  {label}
                </p>
                <div className="flex flex-col gap-1">
                  {items.map((n) => (
                    <NotificationItem
                      key={n.id}
                      id={n.id}
                      type={n.type}
                      title={n.title}
                      body={n.body}
                      isRead={n.isRead}
                      createdAt={n.createdAt}
                      entityType={n.entityType}
                      entityId={n.entityId}
                      onMarkRead={() => void markOneRead(n.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Load more ────────────────────────────────────────────────────── */}
      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void setSize(size + 1)}
            disabled={isValidating}
            className="rounded-xl bg-[#161B22] px-4 py-2 text-sm font-medium text-[#8B93A7] transition-colors hover:text-[#F5F7FA] disabled:cursor-not-allowed"
          >
            {isValidating ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
