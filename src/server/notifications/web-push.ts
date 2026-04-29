// Web Push transport (VAPID). Sends a push payload to all subscriptions
// belonging to a user.
//
// Failure handling per SPEC §4.10:
//   • 410 Gone  → subscription expired; delete it from DB.
//   • Any other failure → bump retryCount on the matching notification row
//     (best-effort; the notification itself remains in the inbox so the user
//     still sees it on their next visit).
//
// VAPID keys are read from env at module load. To generate a fresh pair:
//   npx web-push generate-vapid-keys

import webpush, { type SendResult, type WebPushError } from "web-push";

import { prisma } from "@/lib/prisma";

const PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_EMAIL ?? "mailto:hello@spliteasy.app";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC || !PRIVATE) return false;
  webpush.setVapidDetails(
    SUBJECT.startsWith("mailto:") ? SUBJECT : `mailto:${SUBJECT}`,
    PUBLIC,
    PRIVATE,
  );
  configured = true;
  return true;
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  notificationId?: string;
}

export async function sendWebPush(
  userId: string,
  payload: WebPushPayload,
): Promise<{ delivered: number; removed: number; failed: number }> {
  if (!ensureConfigured()) {
    // No VAPID keys → nothing to do. Don't throw — push is best-effort.
    return { delivered: 0, removed: 0, failed: 0 };
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, keys: true },
  });
  if (subs.length === 0) return { delivered: 0, removed: 0, failed: 0 };

  const body = JSON.stringify(payload);

  let delivered = 0;
  let removed = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      const keys = s.keys as { p256dh?: string; auth?: string } | null;
      if (!keys?.p256dh || !keys?.auth) {
        await prisma.pushSubscription.delete({ where: { id: s.id } });
        removed += 1;
        return;
      }
      try {
        const result: SendResult = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
          body,
        );
        if (result.statusCode >= 200 && result.statusCode < 300) {
          delivered += 1;
        } else {
          failed += 1;
        }
      } catch (err) {
        const e = err as WebPushError;
        if (e.statusCode === 404 || e.statusCode === 410) {
          // Subscription is gone — drop it so we don't keep retrying.
          await prisma.pushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => undefined);
          removed += 1;
          return;
        }
        failed += 1;
        if (payload.notificationId) {
          await prisma.notification
            .update({
              where: { id: payload.notificationId },
              data: { failedAt: new Date(), retryCount: { increment: 1 } },
            })
            .catch(() => undefined);
        }
      }
    }),
  );

  return { delivered, removed, failed };
}
