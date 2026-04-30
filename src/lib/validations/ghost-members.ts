import { z } from "zod";

// Ghost member input per SPEC §4.6. Display name is required so the inviter
// can disambiguate "the cousin" from "the other cousin"; email and phone are
// optional but each must be syntactically valid when supplied so the eventual
// merge-on-signup (per §4.6) has clean keys to match against.

export const ghostDisplayNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Display name is required." })
  .max(80, { message: "Display name is too long." });

const optionalEmail = z
  .string()
  .trim()
  .email({ message: "Enter a valid email." })
  .max(254)
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalPhone = z
  .string()
  .trim()
  .min(7, { message: "Enter a valid phone number." })
  .max(20, { message: "Enter a valid phone number." })
  .regex(/^\+?[0-9 ()-]+$/, { message: "Enter a valid phone number." })
  .optional()
  .or(z.literal("").transform(() => undefined));

export const addGhostMemberSchema = z.object({
  displayName: ghostDisplayNameSchema,
  email: optionalEmail,
  phone: optionalPhone,
});

export type AddGhostMemberInput = z.infer<typeof addGhostMemberSchema>;

export const guestSettlementSchema = z.object({
  receiverId: z.string().uuid({ message: "Receiver id must be a UUID." }),
  amountPaise: z
    .number()
    .int({ message: "Amount must be an integer (paise)." })
    .min(1, { message: "Amount must be at least 1 paise." })
    .max(1_000_000_000, { message: "Amount exceeds the maximum allowed." }),
  paymentMethod: z.enum(["CASH", "UPI", "RAZORPAY", "STRIPE", "OTHER"]).default("CASH"),
  paymentRef: z.string().trim().max(120).optional(),
});

export type GuestSettlementInput = z.infer<typeof guestSettlementSchema>;
