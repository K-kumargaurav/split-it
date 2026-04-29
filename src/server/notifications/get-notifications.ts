// Notification inbox queries. Cursor-paginated by createdAt DESC; cursor
// is the last seen notification's createdAt (ISO string) + id (tie-break).
// SPEC §4.10: in-app feed is the canonical view — push/WhatsApp are
// transport, this is the source of truth.

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export interface InboxItem {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface InboxPage {
  items: InboxItem[];
  unreadCount: number;
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

interface DecodedCursor {
  createdAt: Date;
  id: string;
}

function decodeCursor(raw: string | undefined): DecodedCursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const [iso, id] = decoded.split("|");
    if (!iso || !id) return null;
    const ts = new Date(iso);
    if (Number.isNaN(ts.getTime())) return null;
    return { createdAt: ts, id };
  } catch {
    return null;
  }
}

function encodeCursor(c: { createdAt: Date; id: string }): string {
  return Buffer.from(`${c.createdAt.toISOString()}|${c.id}`, "utf8").toString(
    "base64url",
  );
}

export async function getNotificationsForUser(
  userId: string,
  cursor?: string,
  limit: number = DEFAULT_LIMIT,
  filter: "all" | "unread" = "all",
): Promise<InboxPage> {
  const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const decoded = decodeCursor(cursor);

  const where: {
    userId: string;
    isRead?: boolean;
    AND?: Array<Record<string, unknown>>;
  } = { userId };
  if (filter === "unread") where.isRead = false;
  if (decoded) {
    // Strict cursor: anything with createdAt before the cursor, OR the same
    // createdAt with a smaller id (so consecutive timestamps are stable).
    where.AND = [
      {
        OR: [
          { createdAt: { lt: decoded.createdAt } },
          {
            AND: [
              { createdAt: decoded.createdAt },
              { id: { lt: decoded.id } },
            ],
          },
        ],
      },
    ];
  }

  // Fetch one extra to know whether there's another page.
  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      entityType: true,
      entityId: true,
      isRead: true,
      createdAt: true,
    },
  });

  let nextCursor: string | null = null;
  let items = rows;
  if (rows.length > take) {
    items = rows.slice(0, take);
    const last = items[items.length - 1]!;
    nextCursor = encodeCursor({ createdAt: last.createdAt, id: last.id });
  }

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return {
    items: items.map((r) => ({
      ...r,
      entityType: r.entityType,
      entityId: r.entityId,
    })),
    unreadCount,
    nextCursor,
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markAsRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  // updateMany scoped to userId so a notification can never be marked read
  // by anyone but its owner. Returns count = 0 if not found.
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
  if (result.count === 0) {
    throw new AppError("NOT_FOUND", "Notification not found.");
  }
}

export async function markAllAsRead(userId: string): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { count: result.count };
}
