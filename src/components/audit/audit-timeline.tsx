"use client";

import { useCallback, useState } from "react";
import { m } from "framer-motion";
import { Clock } from "lucide-react";

import { formatDate } from "@/lib/format";
import { TabNav } from "@/components/ui/tab-nav";
import { AuditEntry } from "./audit-entry";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityType =
  | "EXPENSE"
  | "SETTLEMENT"
  | "MEMBER"
  | "GROUP"
  | "CATEGORY"
  | "RECURRING";

type Action =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "APPROVED"
  | "REJECTED"
  | "CONFIRMED"
  | "DISPUTED";

interface Actor {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuditEntryClient {
  id: string;
  actor: Actor;
  entityType: EntityType;
  entityId: string;
  action: Action;
  diffLines: string[];
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Filter config ─────────────────────────────────────────────────────────

type FilterKey = "ALL" | "EXPENSES" | "SETTLEMENTS" | "MEMBERS";

const FILTER_TO_ENTITY: Record<FilterKey, EntityType | null> = {
  ALL: null,
  EXPENSES: "EXPENSE",
  SETTLEMENTS: "SETTLEMENT",
  MEMBERS: "MEMBER",
};

const TABS = [
  { id: "ALL",         label: "All" },
  { id: "EXPENSES",    label: "Expenses" },
  { id: "SETTLEMENTS", label: "Settlements" },
  { id: "MEMBERS",     label: "Members" },
];

// ─── Date grouping helpers ─────────────────────────────────────────────────

interface DateGroup { label: string; entries: AuditEntryClient[]; }

function toISTDateISO(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getISTDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayISO = toISTDateISO(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const entryISO = toISTDateISO(d);
  if (entryISO === todayISO) return "Today";
  if (entryISO === toISTDateISO(yesterday)) return "Yesterday";
  return formatDate(iso);
}

function groupByDate(items: AuditEntryClient[]): DateGroup[] {
  const order: string[] = [];
  const map: Record<string, AuditEntryClient[]> = {};
  for (const item of items) {
    const label = getISTDateLabel(item.createdAt);
    if (!map[label]) { order.push(label); map[label] = []; }
    map[label].push(item);
  }
  return order.map((label) => ({ label, entries: map[label] }));
}

// ─── Stagger variants ──────────────────────────────────────────────────────

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ─── Component ────────────────────────────────────────────────────────────

interface FilterBucket { items: AuditEntryClient[]; cursor: string | null; done: boolean; }
interface ApiResponse  { items: AuditEntryClient[]; nextCursor: string | null; }

interface AuditTimelineProps {
  groupId: string;
  initialItems: AuditEntryClient[];
  initialNextCursor: string | null;
  viewerId: string;
}

export function AuditTimeline({
  groupId,
  initialItems,
  initialNextCursor,
  viewerId,
}: AuditTimelineProps) {
  const [active, setActive] = useState<FilterKey>("ALL");
  const [buckets, setBuckets] = useState<Record<FilterKey, FilterBucket>>({
    ALL:          { items: initialItems, cursor: initialNextCursor, done: initialNextCursor === null },
    EXPENSES:     { items: [], cursor: null, done: false },
    SETTLEMENTS:  { items: [], cursor: null, done: false },
    MEMBERS:      { items: [], cursor: null, done: false },
  });
  const [loading, setLoading] = useState<FilterKey | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [seeded,  setSeeded]  = useState<Record<FilterKey, boolean>>({
    ALL: true, EXPENSES: false, SETTLEMENTS: false, MEMBERS: false,
  });

  const current = buckets[active];
  const items   = current.items;
  const groups  = groupByDate(items);

  const fetchPage = useCallback(
    async (filter: FilterKey, cursor: string | null): Promise<ApiResponse> => {
      const params = new URLSearchParams();
      const entity = FILTER_TO_ENTITY[filter];
      if (entity) params.set("entityType", entity);
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "20");
      const res = await fetch(
        `/api/v1/groups/${groupId}/audit-log?${params.toString()}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error(`Failed to load activity (HTTP ${res.status})`);
      return (await res.json()) as ApiResponse;
    },
    [groupId],
  );

  const handleFilter = useCallback(
    async (id: string) => {
      const filter = id as FilterKey;
      setActive(filter);
      setError(null);
      if (seeded[filter] || loading === filter) return;
      setLoading(filter);
      try {
        const page = await fetchPage(filter, null);
        setBuckets((b) => ({
          ...b,
          [filter]: { items: page.items, cursor: page.nextCursor, done: page.nextCursor === null },
        }));
        setSeeded((s) => ({ ...s, [filter]: true }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load activity.");
      } finally {
        setLoading(null);
      }
    },
    [fetchPage, loading, seeded],
  );

  const handleLoadMore = useCallback(async () => {
    if (loading || current.done || !current.cursor) return;
    setLoading(active);
    setError(null);
    try {
      const page = await fetchPage(active, current.cursor);
      setBuckets((b) => ({
        ...b,
        [active]: {
          items: [...b[active].items, ...page.items],
          cursor: page.nextCursor,
          done: page.nextCursor === null,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more activity.");
    } finally {
      setLoading(null);
    }
  }, [active, current, fetchPage, loading]);

  return (
    <div>
      {/* Filter tabs */}
      <TabNav tabs={TABS} activeTab={active} onChange={handleFilter} />

      {/* Error */}
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-[13px] text-error"
        >
          {error}
        </div>
      ) : null}

      {/* Initial loading */}
      {loading && items.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-text-secondary">Loading…</p>
      ) : null}

      {/* Empty state */}
      {items.length === 0 && !loading ? (
        <div className="flex flex-col items-center py-16 text-center" role="status">
          <Clock size={40} className="mb-4 text-text-secondary" aria-hidden="true" />
          <p className="text-[15px] font-medium text-text-primary">No activity yet</p>
          <p className="mt-1 max-w-xs text-[13px] text-text-secondary">
            Changes to expenses and settlements appear here
          </p>
        </div>
      ) : null}

      {/* Timeline grouped by date */}
      {groups.length > 0 ? (
        <div className="space-y-8">
          {groups.map(({ label, entries }) => (
            <div key={label}>
              {/* Date header */}
              <div className="mb-4 flex items-center gap-3">
                <span className="flex-shrink-0 text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
                  {label}
                </span>
                <div className="h-px flex-1 bg-white/[0.05]" aria-hidden="true" />
              </div>

              {/* Staggered entries */}
              <m.ol
                variants={staggerContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                aria-label={`Activity from ${label}`}
              >
                {entries.map((entry, i) => (
                  <m.li key={entry.id} variants={staggerItem}>
                    <AuditEntry
                      entry={entry}
                      viewerId={viewerId}
                      isLast={i === entries.length - 1}
                    />
                  </m.li>
                ))}
              </m.ol>
            </div>
          ))}
        </div>
      ) : null}

      {/* Load more */}
      {!current.done && items.length > 0 ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading !== null}
            className="inline-flex h-10 items-center rounded-2xl border border-white/10 px-6 text-sm font-medium text-text-secondary transition hover:border-white/20 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === active ? "Loading…" : "Load more activity"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
