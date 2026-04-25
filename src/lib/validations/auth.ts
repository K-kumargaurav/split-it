import { z } from "zod";

// Per CLAUDE.md auth rules: bcrypt salt rounds >= 12, never expose passwords.
// Per the email/password ticket: min 8 chars, at least 1 uppercase, at least
// 1 number. Cap at 128 — bcrypt only hashes the first 72 bytes; allowing
// arbitrarily long passwords is a DoS vector (long bcrypt compares).
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, { message: `Password must be at least ${PASSWORD_MIN} characters.` })
  .max(PASSWORD_MAX, { message: `Password must be at most ${PASSWORD_MAX} characters.` })
  .refine((s) => /[A-Z]/.test(s), {
    message: "Password must contain at least one uppercase letter.",
  })
  .refine((s) => /[0-9]/.test(s), {
    message: "Password must contain at least one number.",
  });

// Max 254 — RFC 5321 limit for the full address.
// Normalize (trim + lowercase) BEFORE validating, so " USER@Example.COM " is
// accepted. In Zod v4 a trailing `.transform` would run only after the format
// check, which would reject the unnormalized input.
export const emailSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z
    .email({ message: "Enter a valid email address." })
    .max(254, { message: "Email is too long." }),
);

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name is required." })
  .max(80, { message: "Name is too long." });

// Handles are part of the user's public identity (@asha_p) and are used in
// share links. Lowercase alphanumeric + underscores only — no dots, hyphens,
// or unicode confusables. Must start with a letter to keep handles readable.
export const handleSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z
    .string()
    .min(3, { message: "Handle must be at least 3 characters." })
    .max(20, { message: "Handle must be at most 20 characters." })
    .regex(/^[a-z][a-z0-9_]*$/, {
      message: "Use lowercase letters, numbers, and underscores. Must start with a letter.",
    }),
);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  handle: handleSchema,
});

export const checkHandleSchema = z.object({
  handle: handleSchema,
});

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1).max(512),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type CheckHandleInput = z.infer<typeof checkHandleSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
