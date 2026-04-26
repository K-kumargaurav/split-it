import { z } from "zod";

// Group fields per SPEC §4.1.
//
// Currency is locked at creation (cannot be changed once an expense exists),
// but we accept any 3-letter ISO 4217-shaped code at write-time. The default
// is INR — this app is India-first.
//
// Color/icon are presentational. Color is a #RRGGBB hex (or null); icon is a
// short emoji or single-character monogram.
//
// balanceMode: DIRECT (raw pairwise debts) | SIMPLIFIED (debt-graph reduced).

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Group name is required." })
  .max(80, { message: "Group name is too long." });

export const groupDescriptionSchema = z
  .string()
  .trim()
  .max(500, { message: "Description is too long." });

export const groupCurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, { message: "Currency must be a 3-letter code (e.g. INR)." });

export const groupColorSchema = z
  .string()
  .trim()
  .regex(HEX_COLOR, { message: "Color must be a hex like #6366F1." });

export const groupIconSchema = z
  .string()
  .trim()
  .min(1)
  .max(8, { message: "Icon is too long." });

export const balanceModeSchema = z.enum(["DIRECT", "SIMPLIFIED"]);

export const createGroupSchema = z.object({
  name: groupNameSchema,
  description: groupDescriptionSchema.optional(),
  currency: groupCurrencySchema.default("INR"),
  color: groupColorSchema.optional(),
  icon: groupIconSchema.optional(),
  balanceMode: balanceModeSchema.default("DIRECT"),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
