
import { z } from "zod";

// Invite + invite-link schemas for SPEC §4.1. The same POST endpoint accepts
// either form (discriminated by `type`); the discriminated union keeps each
// branch's required fields tight (email is required for "email", maxUses
// optional for "link").

const MAX_USES_DEFAULT = 100;
const MAX_USES_CAP = 500;

export const emailInviteSchema = z.object({
  type: z.literal("email"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Enter a valid email address." })
    .max(254, { message: "Email is too long." }),
});

export const linkInviteSchema = z.object({
  type: z.literal("link"),
  maxUses: z
    .number()
    .int({ message: "maxUses must be an integer." })
    .min(1, { message: "maxUses must be at least 1." })
    .max(MAX_USES_CAP, { message: `maxUses cannot exceed ${MAX_USES_CAP}.` })
    .default(MAX_USES_DEFAULT)
    .optional(),
});

export const inviteRequestSchema = z.discriminatedUnion("type", [
  emailInviteSchema,
  linkInviteSchema,
]);

export type InviteRequestInput = z.infer<typeof inviteRequestSchema>;

export const joinByTokenSchema = z.object({
  token: z
    .string()
    .min(10, { message: "Invalid invite token." })
    .max(256, { message: "Invalid invite token." }),
});

export type JoinByTokenInput = z.infer<typeof joinByTokenSchema>;

export const INVITE_LINK_DEFAULT_MAX_USES = MAX_USES_DEFAULT;
export const INVITE_LINK_MAX_USES_CAP = MAX_USES_CAP;
