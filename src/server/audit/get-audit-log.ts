import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { formatPaise } from "@/lib/format";

// Paginated read of a group's audit log per SPEC §4.11. Mirrors the
// settlements list pattern: cursor on log id, ordering by createdAt DESC
// with id-tiebreak so the cursor remains stable across same-millisecond
// inserts.
//
// The diff column is a free-form jsonb. To keep the UI from having to know
// each entity's schema, we render a small set of well-known field changes
// ("amount", "title", "status", …) into human-readable strings here on the
// server. Unknown shapes fall through as `${field} updated`.

export type AuditEntityType =
  | "EXPENSE"
  | "SETTLEMENT"
  | "MEMBER"
  | "GROUP"
  | "CATEGORY"
  | "RECURRING";

export type AuditAction =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "APPROVED"
  | "REJECTED"
  | "CONFIRMED"
  | "DISPUTED";

export interface AuditActor {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuditLogItem {
  id: string;
  actor: AuditActor;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  diffLines: string[];
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  nextCursor: string | null;
}

export interface AuditLogFilters {
  entityType?: AuditEntityType;
  actorId?: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function getAuditLog(
  userId: string,
  groupId: string,
  filters: AuditLogFilters = {},
  cursor?: string,
  limit: number = DEFAULT_LIMIT,
): Promise<AuditLogPage> {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }

  const take = Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);

  const where: Prisma.AuditLogWhereInput = { groupId };
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.actorId) where.actorId = filters.actorId;

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      actor: {
        select: { id: true, handle: true, displayName: true, avatarUrl: true },
      },
    },
  });

  const hasMore = rows.length > take;
  const visible = hasMore ? rows.slice(0, take) : rows;

  const items: AuditLogItem[] = visible.map((r) => ({
    id: r.id,
    actor: {
      id: r.actor.id,
      handle: r.actor.handle,
      displayName: r.actor.displayName,
      avatarUrl: r.actor.avatarUrl,
    },
    entityType: r.entityType,
    entityId: r.entityId,
    action: r.action,
    diffLines: formatDiff(r.diff, r.oldValue, r.newValue, r.action),
    oldValue: jsonAsRecord(r.oldValue),
    newValue: jsonAsRecord(r.newValue),
    createdAt: r.createdAt,
  }));

  return {
    items,
    nextCursor: hasMore && visible.length > 0 ? visible[visible.length - 1]!.id : null,
  };
}

function jsonAsRecord(v: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

// Rendering rules:
//   - `diff` is preferred when present; we look for { field: { from, to } }
//     or { field: [from, to] } shapes.
//   - Otherwise we fall back to a shallow keys-in-both-objects compare on
//     old vs new.
//   - Money fields (anything ending in "Paise" or named "amount"/"total")
//     render as ₹ amounts; "title"/"name"/"notes" render quoted; everything
//     else renders verbatim.
function formatDiff(
  diff: Prisma.JsonValue | null,
  oldValue: Prisma.JsonValue | null,
  newValue: Prisma.JsonValue | null,
  action: AuditAction,
): string[] {
  if (action !== "UPDATED") return [];

  const pairs = extractPairs(diff, oldValue, newValue);
  const lines: string[] = [];
  for (const { field, from, to } of pairs) {
    if (sameValue(from, to)) continue;
    lines.push(renderFieldChange(field, from, to));
  }
  return lines;
}

interface DiffPair {
  field: string;
  from: unknown;
  to: unknown;
}

function extractPairs(
  diff: Prisma.JsonValue | null,
  oldValue: Prisma.JsonValue | null,
  newValue: Prisma.JsonValue | null,
): DiffPair[] {
  if (diff && typeof diff === "object" && !Array.isArray(diff)) {
    const out: DiffPair[] = [];
    for (const [field, value] of Object.entries(diff as Record<string, unknown>)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        if ("from" in obj || "to" in obj) {
          out.push({ field, from: obj.from, to: obj.to });
          continue;
        }
        if ("old" in obj || "new" in obj) {
          out.push({ field, from: obj.old, to: obj.new });
          continue;
        }
      }
      if (Array.isArray(value) && value.length === 2) {
        out.push({ field, from: value[0], to: value[1] });
        continue;
      }
      out.push({ field, from: undefined, to: value });
    }
    return out;
  }

  if (
    oldValue &&
    newValue &&
    typeof oldValue === "object" &&
    typeof newValue === "object" &&
    !Array.isArray(oldValue) &&
    !Array.isArray(newValue)
  ) {
    const oldObj = oldValue as Record<string, unknown>;
    const newObj = newValue as Record<string, unknown>;
    const fieldsMap: Record<string, true> = {};
    for (const k of Object.keys(oldObj)) fieldsMap[k] = true;
    for (const k of Object.keys(newObj)) fieldsMap[k] = true;
    const out: DiffPair[] = [];
    for (const field of Object.keys(fieldsMap)) {
      out.push({ field, from: oldObj[field], to: newObj[field] });
    }
    return out;
  }

  return [];
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

const MONEY_FIELDS = new Set([
  "amount",
  "total",
  "totalAmount",
  "totalAmountPaise",
  "amountPaise",
  "baseAmount",
  "baseAmountPaise",
  "taxAmount",
  "taxAmountPaise",
  "tipAmount",
  "tipAmountPaise",
]);

const QUOTED_FIELDS = new Set([
  "title",
  "name",
  "notes",
  "description",
  "displayName",
  "category",
  "categoryName",
]);

function renderFieldChange(field: string, from: unknown, to: unknown): string {
  const label = humanizeField(field);
  if (isMoneyField(field)) {
    return `${label} changed from ${renderMoney(from)} to ${renderMoney(to)}`;
  }
  if (QUOTED_FIELDS.has(field)) {
    return `${label} changed from ${renderQuoted(from)} to ${renderQuoted(to)}`;
  }
  return `${label} changed from ${renderPlain(from)} to ${renderPlain(to)}`;
}

function isMoneyField(field: string): boolean {
  if (MONEY_FIELDS.has(field)) return true;
  return field.endsWith("Paise") || field.endsWith("AmountPaise");
}

function humanizeField(field: string): string {
  // Trim trailing "Paise" so "amountPaise" → "Amount".
  const base = field.replace(/Paise$/, "");
  // Insert spaces between camelCase: "splitType" → "split Type".
  const spaced = base.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function renderMoney(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return formatPaise(v);
  if (typeof v === "bigint") return formatPaise(v);
  if (typeof v === "string" && /^-?\d+$/.test(v)) return formatPaise(BigInt(v));
  return String(v);
}

function renderQuoted(v: unknown): string {
  if (v == null) return "—";
  return `'${String(v)}'`;
}

function renderPlain(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") {
    return String(v);
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
