"use client";

import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

// Client-side timeline + filter + "Load more" for the audit page. The first
// page is rendered server-side (props.initialItems / initialNextCursor) so
// the page is useful with JS disabled; subsequent pages are fetched from
// `GET /api/v1/groups/:id/audit-log` with the same cursor protocol.

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
  // Always serialised into ISO before reaching the client.
  createdAt: string;
}

type FilterKey = "ALL" | "EXPENSES" | "SETTLEMENTS" | "MEMBERS";

const FILTER_TO_ENTITY: Record<FilterKey, EntityType | null> = {
  ALL: null,
  EXPENSES: "EXPENSE",
  SETTLEMENTS: "SETTLEMENT",
  MEMBERS: "MEMBER",
};

const FILTER_LABELS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "EXPENSES", label: "Expenses" },
  { key: "SETTLEMENTS", label: "Settlements" },
  { key: "MEMBERS", label: "Members" },
];

interface ApiResponse {
  items: AuditEntryClient[];
  nextCursor: string | null;
}

interface AuditTimelineProps {
  groupId: string;
  initialItems: AuditEntryClient[];
  initialNextCursor: string | null;
  viewerId: string;
}

interface FilterBucket {
  items: AuditEntryClient[];
  cursor: string | null;
  done: boolean;
}

export function AuditTimeline({
  groupId,
  initialItems,
  initialNextCursor,
  viewerId,
}: AuditTimelineProps) {
  const [active, setActive] = useState<FilterKey>("ALL");
  // Each filter keeps its own paginated bucket so switching back to "All"
  // doesn't refetch data we already have. The "ALL" bucket is seeded from
  // SSR; the others lazy-load on first selection.
  const [buckets, setBuckets] = useState<Record<FilterKey, FilterBucket>>({
    ALL: { items: initialItems, cursor: initialNextCursor, done: initialNextCursor === null },
    EXPENSES: { items: [], cursor: null, done: false },
    SETTLEMENTS: { items: [], cursor: null, done: false },
    MEMBERS: { items: [], cursor: null, done: false },
  });
  const [loading, setLoading] = useState<FilterKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState<Record<FilterKey, boolean>>({
    ALL: true,
    EXPENSES: false,
    SETTLEMENTS: false,
    MEMBERS: false,
  });

  const current = buckets[active];

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
      if (!res.ok) {
        throw new Error(`Failed to load activity (HTTP ${res.status})`);
      }
      return (await res.json()) as ApiResponse;
    },
    [groupId],
  );

  const handleFilter = useCallback(
    async (filter: FilterKey) => {
      setActive(filter);
      setError(null);
      if (seeded[filter] || loading === filter) return;

      setLoading(filter);
      try {
        const page = await fetchPage(filter, null);
        setBuckets((b) => ({
          ...b,
          [filter]: {
            items: page.items,
            cursor: page.nextCursor,
            done: page.nextCursor === null,
          },
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

  const items = current.items;

  return (
    <section
      aria-labelledby="audit-heading"
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="audit-heading"
          className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          Activity
        </h2>
      </div>

      <div
        role="tablist"
        aria-label="Activity filters"
        className="mb-6 flex flex-wrap gap-2"
      >
        {FILTER_LABELS.map(({ key, label }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                isActive
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      {items.length === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No activity yet
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Edits, settlements, and member changes will appear here.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {items.map((entry) => (
            <AuditEntry key={entry.id} entry={entry} viewerId={viewerId} />
          ))}
        </ol>
      )}

      {!current.done && items.length > 0 ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading !== null}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === active ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : null}
    </section>
  );
}

function AuditEntry({
  entry,
  viewerId,
}: {
  entry: AuditEntryClient;
  viewerId: string;
}) {
  const isYou = entry.actor.id === viewerId;
  const actorName = isYou ? "You" : entry.actor.displayName;
  const actionVerb = describeAction(entry.action, entry.entityType, isYou);
  const target = describeTarget(entry);
  const headline = target ? `${actorName} ${actionVerb} ${target}` : `${actorName} ${actionVerb}`;
  const hasDiff = entry.diffLines.length > 0;

  return (
    <li className="flex gap-3">
      <Avatar actor={entry.actor} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-white">{headline}</span>
        </p>
        <p
          className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
          title={formatDateTime(entry.createdAt)}
        >
          {formatRelativeTime(entry.createdAt)} · {formatDateTime(entry.createdAt)}
        </p>
        {hasDiff ? (
          <details className="group mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 open:bg-white dark:open:bg-slate-900">
            <summary className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-500">
              View changes
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-200">
              {entry.diffLines.map((line, i) => (
                <li key={i} className="leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </li>
  );
}

function Avatar({ actor }: { actor: Actor }) {
  const initial = (actor.displayName[0] ?? actor.handle[0] ?? "?").toUpperCase();
  if (actor.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={actor.avatarUrl}
        alt={`${actor.displayName} avatar`}
        className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white"
    >
      {initial}
    </span>
  );
}

function describeAction(action: Action, entityType: EntityType, isYou: boolean): string {
  const entity = entityLabel(entityType);
  switch (action) {
    case "CREATED":
      return isYou ? `added a new ${entity}` : `added a new ${entity}`;
    case "UPDATED":
      return `edited`;
    case "DELETED":
      return `deleted`;
    case "APPROVED":
      return `approved a change to`;
    case "REJECTED":
      return `rejected a change to`;
    case "CONFIRMED":
      return `confirmed`;
    case "DISPUTED":
      return `disputed`;
    default:
      return `changed`;
  }
}

function entityLabel(entityType: EntityType): string {
  switch (entityType) {
    case "EXPENSE":
      return "expense";
    case "SETTLEMENT":
      return "settlement";
    case "MEMBER":
      return "member";
    case "GROUP":
      return "group";
    case "CATEGORY":
      return "category";
    case "RECURRING":
      return "recurring template";
  }
}

function describeTarget(entry: AuditEntryClient): string {
  const title =
    pickString(entry.newValue, "title") ??
    pickString(entry.newValue, "name") ??
    pickString(entry.newValue, "displayName") ??
    pickString(entry.oldValue, "title") ??
    pickString(entry.oldValue, "name") ??
    pickString(entry.oldValue, "displayName");

  if (title) return `'${title}'`;
  if (entry.action === "CREATED") return "";
  return `a ${entityLabel(entry.entityType)}`;
}

function pickString(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null;
  const v = obj[key];
  if (typeof v === "string" && v.trim().length > 0) return v;
  return null;
}
