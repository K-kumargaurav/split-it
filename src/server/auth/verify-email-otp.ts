"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { OTP_TTL_MS, createEmailOtp } from "@/server/auth/email-otp";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";
import { sendEmailOtpEmail } from "@/server/email/auth-emails";

// OTP verification was historically a separate server action that flipped
// emailVerifiedAt and let the client follow up with a manual signIn(). It's
// now folded into the "otp" CredentialsProvider in src/lib/auth.ts — the
// client form calls signIn("otp", { email, otp, redirect: false }) and
// NextAuth's authorize() handles verification + session creation in one
// step. Only the resend (send) side remains here, since it's a side effect
// (issue + email) that doesn't fit the authorize() shape.

export interface ResendOtpResult {
  ok: boolean;
  formError?: string;
}

// Resend rate limit is intentionally tighter than verify: each resend issues
// a fresh OTP, invalidating the previous one — abused, this could spam an
// inbox or extend an attacker's brute-force window.
export async function resendEmailOtpAction(rawEmail: unknown): Promise<ResendOtpResult> {
  if (typeof rawEmail !== "string") {
    return { ok: false, formError: "Invalid request." };
  }
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, formError: "Invalid email." };
  }

  const ip = getClientIp(await headers());
  if (!(await consumeRateLimit(`otp-resend:${email}:${ip}`))) {
    return {
      ok: false,
      formError: "Please wait a minute before requesting another code.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, displayName: true, deletedAt: true, emailVerifiedAt: true },
  });
  // Always return ok regardless of existence/verification status — the resend
  // happens *during* registration, where the client already knows the email
  // is in our system. The only purpose of the check is to skip work for the
  // already-verified or deleted edge cases.
  if (!user || user.deletedAt || user.emailVerifiedAt) {
    return { ok: true };
  }

  try {
    const code = await createEmailOtp({ email });
    await sendEmailOtpEmail({
      to: email,
      displayName: user.displayName,
      code,
      ttlMinutes: Math.round(OTP_TTL_MS / 60_000),
    });
  } catch (err) {
    console.error("resendEmailOtpAction failed", err);
    return { ok: false, formError: "Couldn't send a new code. Please try again." };
  }
  return { ok: true };
}
