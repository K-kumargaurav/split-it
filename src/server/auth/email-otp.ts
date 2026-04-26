import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

// Per SPEC §2.1: 6-digit OTP, valid 15 minutes.
export const OTP_TTL_MS = 15 * 60 * 1000;
const OTP_LENGTH = 6;

// Salt the hash with the email so:
//   1) two users that randomly draw the same OTP store DIFFERENT hashes —
//      avoids the tokenHash @unique collision, and removes any cross-account
//      reuse vector if a hash leaks.
//   2) the URL-token path (sha256 of the raw token, no salt) and the OTP
//      path (sha256 of "EMAIL_OTP:<email>:<code>") never collide on the
//      shared tokenHash column, so both flows can coexist on the same row
//      type without interference.
export function hashOtp(email: string, code: string): string {
  return createHash("sha256")
    .update(`EMAIL_OTP:${email.toLowerCase()}:${code}`)
    .digest("hex");
}

export function generateOtp(): string {
  // randomInt is uniform — Math.random would bias the high digits.
  const max = 10 ** OTP_LENGTH;
  return randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

interface CreateOtpInput {
  email: string;
}

// Issues an OTP, replacing any prior outstanding EMAIL_VERIFICATION token for
// this email. Returns the raw 6-digit code so the caller can email it.
export async function createEmailOtp(input: CreateOtpInput): Promise<string> {
  const code = generateOtp();
  const tokenHash = hashOtp(input.email, code);
  const expires = new Date(Date.now() + OTP_TTL_MS);

  await prisma.verificationToken.upsert({
    where: {
      identifier_purpose: { identifier: input.email, purpose: "EMAIL_VERIFICATION" },
    },
    create: {
      identifier: input.email,
      purpose: "EMAIL_VERIFICATION",
      tokenHash,
      expires,
    },
    update: { tokenHash, expires, createdAt: new Date() },
  });

  return code;
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "not-found" };

interface VerifyOtpInput {
  email: string;
  code: string;
}

// Verifies an OTP by looking up the row by (identifier, purpose) and
// constant-time-comparing the recomputed hash. On success, deletes the row
// so the same OTP can't be redeemed twice (best-effort — concurrent
// redemptions still fail safely because Prisma returns null on second try).
export async function verifyEmailOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const record = await prisma.verificationToken.findUnique({
    where: {
      identifier_purpose: { identifier: input.email, purpose: "EMAIL_VERIFICATION" },
    },
    select: { tokenHash: true, expires: true },
  });

  if (!record) return { ok: false, reason: "not-found" };

  if (record.expires.getTime() <= Date.now()) {
    await prisma.verificationToken
      .delete({
        where: {
          identifier_purpose: { identifier: input.email, purpose: "EMAIL_VERIFICATION" },
        },
      })
      .catch(() => undefined);
    return { ok: false, reason: "expired" };
  }

  const candidate = hashOtp(input.email, input.code);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(record.tokenHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }

  // Single-use: delete the row. If a concurrent caller already won the race
  // and deleted it, treat this attempt as invalid.
  try {
    await prisma.verificationToken.delete({
      where: {
        identifier_purpose: { identifier: input.email, purpose: "EMAIL_VERIFICATION" },
      },
    });
  } catch {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true };
}
