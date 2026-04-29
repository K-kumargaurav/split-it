import { z } from "zod";

// Notification event types — must match prisma enum NotificationEventType.
const EVENT_TYPES = [
  "EXPENSE_ADDED",
  "EXPENSE_EDITED",
  "EXPENSE_EDIT_PROPOSAL",
  "SETTLEMENT_PENDING_CONFIRMATION",
  "SETTLEMENT_CONFIRMED",
  "SETTLEMENT_DISPUTED",
  "RECURRING_EXPENSE_ADDED",
  "GROUP_INVITE_RECEIVED",
  "MEMBERSHIP_CHANGED",
] as const;

export const notificationEventTypeSchema = z.enum(EVENT_TYPES);

// PATCH /users/me/notification-prefs — array of channel toggles per event.
export const updateNotificationPrefsSchema = z.object({
  prefs: z
    .array(
      z.object({
        eventType: notificationEventTypeSchema,
        inApp: z.boolean().optional(),
        push: z.boolean().optional(),
        whatsappSms: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(EVENT_TYPES.length),
});

export type UpdateNotificationPrefsInput = z.infer<
  typeof updateNotificationPrefsSchema
>;

// POST /users/me/push-subscription — Web Push API JSON.stringify(sub) shape.
export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const inboxQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  filter: z.enum(["all", "unread"]).optional(),
});

export type InboxQuery = z.infer<typeof inboxQuerySchema>;
