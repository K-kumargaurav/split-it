import { z } from "zod";

import { displayNameSchema, handleSchema } from "@/lib/validations/auth";

// UPI VPA: lowercase alphanumeric + dot/underscore/hyphen, single '@', and a
// non-empty PSP label. Permissive on purpose — handles vary across PSPs (icici,
// upi, axisbank, oksbi, paytm, …) and we don't want to lock users out by
// over-validating. Length cap matches the schema column.
export const upiIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { message: "UPI ID is too short." })
  .max(100, { message: "UPI ID is too long." })
  .regex(/^[a-z0-9._-]+@[a-z0-9._-]+$/, {
    message: "Use the format yourname@upi or phone@bank.",
  });

// Avatars must be HTTPS URLs that point to our Supabase Storage bucket — never
// arbitrary user-supplied URLs (XSS / phishing risk in <img> tags). The exact
// bucket prefix is enforced at a higher level; here we only require https + a
// reasonable length cap.
export const avatarUrlSchema = z
  .string()
  .trim()
  .url({ message: "Avatar URL must be a valid URL." })
  .max(2048, { message: "Avatar URL is too long." })
  .refine((v) => v.startsWith("https://"), {
    message: "Avatar URL must use HTTPS.",
  });

// PATCH body: every field is optional, but the request must update at least
// one field. Empty strings are normalised to `null` for the nullable columns
// (avatarUrl, upiId) so the client can clear a value by sending "".
export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    handle: handleSchema.optional(),
    avatarUrl: z
      .union([avatarUrlSchema, z.literal("").transform(() => null), z.null()])
      .optional(),
    upiId: z
      .union([upiIdSchema, z.literal("").transform(() => null), z.null()])
      .optional(),
  })
  .refine(
    (v) =>
      v.displayName !== undefined ||
      v.handle !== undefined ||
      v.avatarUrl !== undefined ||
      v.upiId !== undefined,
    { message: "Provide at least one field to update." },
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
