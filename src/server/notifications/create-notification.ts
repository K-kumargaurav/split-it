// Central notification entrypoint per SPEC §4.10.
//
// Two surfaces:
//   • createNotification(input)        — single-recipient. Inserts the row,
//                                        then dispatches push + WhatsApp
//                                        according to the user's prefs.
//   • notifyManyInTx(tx, ids, opts)    — multi-recipient inside an active
//                                        transaction. Inserts in-app rows
//                                        atomically with the surrounding
//                                        mutation, returns inserted IDs so
//                                        the caller can dispatch external
//                                        channels post-commit.
//   • dispatchExternal(userIds, opts)  — fan-out push + WhatsApp for many
//                                        recipients. Best-effort; never
//                                        throws — logs and moves on.
//
// Defaults when a user has no prefs row for an event type:
//   inApp = true, push = true, whatsappSms = false.

import type {
  AuditEntityType,
  NotificationEventType,
  Prisma,
} from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

import { sendWebPush } from "./web-push";
import { sendWhatsApp } from "./whatsapp";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationEventType;
  title: string;
  body: string;
  entityType?: AuditEntityType | null;
  entityId?: string | null;
  url?: string;
}

export interface NotifyManyOpts {
  type: NotificationEventType;
  title: string;
  body: string;
  entityType?: AuditEntityType | null;
  entityId?: string | null;
  url?: string;
}

interface ResolvedPrefs {
  inApp: boolean;
  push: boolean;
  whatsappSms: boolean;
}

// Per SPEC §4.10 the default (no-pref-row) channel mix differs per event.
// `whatsappSms` is always opt-in. These mirror the table in the spec —
// events that don't appear there (MEMBERSHIP_CHANGED, RECURRING_*) follow
// the in-app-only column.
const DEFAULT_BY_EVENT: Record<NotificationEventType, ResolvedPrefs> = {
  EXPENSE_ADDED: { inApp: true, push: true, whatsappSms: false },
  EXPENSE_EDITED: { inApp: true, push: true, whatsappSms: false },
  EXPENSE_EDIT_PROPOSAL: { inApp: true, push: true, whatsappSms: false },
  SETTLEMENT_PENDING_CONFIRMATION: {
    inApp: true,
    push: true,
    whatsappSms: false,
  },
  SETTLEMENT_CONFIRMED: { inApp: true, push: true, whatsappSms: false },
  SETTLEMENT_DISPUTED: { inApp: true, push: true, whatsappSms: false },
  RECURRING_EXPENSE_ADDED: { inApp: true, push: false, whatsappSms: false },
  GROUP_INVITE_RECEIVED: { inApp: true, push: true, whatsappSms: false },
  MEMBERSHIP_CHANGED: { inApp: true, push: false, whatsappSms: false },
};

const FALLBACK: ResolvedPrefs = {
  inApp: true,
  push: true,
  whatsappSms: false,
};

function defaultsFor(type: NotificationEventType): ResolvedPrefs {
  return DEFAULT_BY_EVENT[type] ?? FALLBACK;
}

async function resolvePrefs(
  userId: string,
  type: NotificationEventType,
): Promise<ResolvedPrefs> {
  const row = await prisma.notificationPref.findUnique({
    where: { userId_eventType: { userId, eventType: type } },
    select: { inApp: true, push: true, whatsappSms: true },
  });
  return row ?? defaultsFor(type);
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<{ notificationId: string | null }> {
  const prefs = await resolvePrefs(input.userId, input.type);

  let notificationId: string | null = null;
  if (prefs.inApp) {
    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      select: { id: true },
    });
    notificationId = row.id;
  }

  // Fire-and-forget: push + WhatsApp run after the DB insert. Failures
  // are logged inside the transports so the caller's flow is unaffected.
  void dispatchOne(input, prefs, notificationId);

  return { notificationId };
}

async function dispatchOne(
  input: CreateNotificationInput,
  prefs: ResolvedPrefs,
  notificationId: string | null,
): Promise<void> {
  if (prefs.push) {
    sendWebPush(input.userId, {
      title: input.title,
      body: input.body,
      url: input.url,
      notificationId: notificationId ?? undefined,
    }).catch((err: unknown) => {
      console.error("[notifications] push failed", err);
    });
  }
  if (prefs.whatsappSms) {
    const user = await prisma.user
      .findUnique({ where: { id: input.userId }, select: { phone: true } })
      .catch(() => null);
    if (user?.phone) {
      sendWhatsApp(user.phone, `${input.title}: ${input.body}`).catch(
        (err: unknown) => {
          console.error("[notifications] whatsapp failed", err);
        },
      );
    }
  }
}

// Used inside a Prisma transaction by callers that already have a tx
// client. Inserts in-app rows atomically with the surrounding work.
// Returns the IDs so the caller can dispatch external channels after the
// transaction commits.
export async function notifyManyInTx(
  tx: Prisma.TransactionClient,
  userIds: string[],
  opts: NotifyManyOpts,
): Promise<string[]> {
  if (userIds.length === 0) return [];

  // Filter recipients by their inApp pref. Default is per-event (see
  // DEFAULT_BY_EVENT) — one findMany is cheaper than N round trips
  // inside the transaction.
  const prefs = await tx.notificationPref.findMany({
    where: { eventType: opts.type, userId: { in: userIds } },
    select: { userId: true, inApp: true },
  });
  const prefBy = new Map(prefs.map((p) => [p.userId, p.inApp]));
  const inAppDefault = defaultsFor(opts.type).inApp;
  const recipients = userIds.filter((uid) => prefBy.get(uid) ?? inAppDefault);

  if (recipients.length === 0) return [];

  // createMany is faster but doesn't return IDs on Postgres without
  // createManyAndReturn. We need IDs to feed dispatchExternal so it can
  // back-link push payloads to a specific notification row. Use N inserts.
  const ids: string[] = [];
  for (const uid of recipients) {
    const row = await tx.notification.create({
      data: {
        userId: uid,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
      },
      select: { id: true },
    });
    ids.push(row.id);
  }
  return ids;
}

// Post-commit fan-out. Reads each user's prefs once and dispatches push
// and/or WhatsApp accordingly. Never throws — wraps the whole thing in
// try/catch so callers can fire-and-forget without rejection plumbing.
export async function dispatchExternal(
  userIds: string[],
  opts: NotifyManyOpts,
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const prefs = await prisma.notificationPref.findMany({
      where: { eventType: opts.type, userId: { in: userIds } },
      select: { userId: true, push: true, whatsappSms: true },
    });
    const byId = new Map(prefs.map((p) => [p.userId, p]));
    const eventDefaults = defaultsFor(opts.type);

    await Promise.all(
      userIds.map(async (uid) => {
        const p = byId.get(uid) ?? {
          push: eventDefaults.push,
          whatsappSms: eventDefaults.whatsappSms,
        };
        try {
          if (p.push) {
            await sendWebPush(uid, {
              title: opts.title,
              body: opts.body,
              url: opts.url,
            });
          }
          if (p.whatsappSms) {
            const user = await prisma.user.findUnique({
              where: { id: uid },
              select: { phone: true },
            });
            if (user?.phone) {
              await sendWhatsApp(
                user.phone,
                `${opts.title}: ${opts.body}`,
              );
            }
          }
        } catch (err) {
          console.error("[notifications] dispatch one failed", err);
        }
      }),
    );
  } catch (err) {
    console.error("[notifications] dispatchExternal failed", err);
  }
}

// Post-commit helper for group-wide notifications. Inserts in-app rows
// for every member except those in `excludeUserIds`, then dispatches
// push + WhatsApp for the same recipients. Never throws — every failure
// is logged so the caller's mutation flow is unaffected.
export async function notifyGroupMembersAfterCommit(
  groupId: string,
  excludeUserIds: string[],
  opts: NotifyManyOpts,
): Promise<void> {
  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const exclude = new Set(excludeUserIds);
    const recipients = members
      .map((m) => m.userId)
      .filter((uid) => !exclude.has(uid));
    if (recipients.length === 0) return;

    // Filter by inApp pref (default is per-event).
    const prefs = await prisma.notificationPref.findMany({
      where: { eventType: opts.type, userId: { in: recipients } },
      select: { userId: true, inApp: true },
    });
    const inAppBy = new Map(prefs.map((p) => [p.userId, p.inApp]));
    const inAppDefault = defaultsFor(opts.type).inApp;
    const inAppRecipients = recipients.filter(
      (uid) => inAppBy.get(uid) ?? inAppDefault,
    );

    if (inAppRecipients.length > 0) {
      await prisma.notification.createMany({
        data: inAppRecipients.map((userId) => ({
          userId,
          type: opts.type,
          title: opts.title,
          body: opts.body,
          entityType: opts.entityType ?? null,
          entityId: opts.entityId ?? null,
        })),
      });
    }

    await dispatchExternal(recipients, opts);
  } catch (err) {
    console.error("[notifications] notifyGroupMembersAfterCommit failed", err);
  }
}
