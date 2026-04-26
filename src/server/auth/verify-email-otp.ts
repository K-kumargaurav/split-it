"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { verifyEmailOtpSchema } from "@/lib/validations/auth";
import {
  OTP_TTL_MS,
  createEmailOtp,
  verifyEmailOtp as verifyOtp,
} from "@/server/auth/email-otp";
import {
  consumeRateLimit,
  getClientIp,
  RateLimitOptions,
} from "@/server/auth/rate-limit";
import { sendEmailOtpEmail } from "@/server/email/auth-emails";

export interface VerifyEmailOtpResult {
  ok: boolean;
  formError?: string;
}

// Brute-forcing a 6-digit OTP: 1M combinations. With 10 attempts allowed per
// 15-min OTP window per email, the per-OTP success rate for a blind attacker
// is 10 / 1_000_000 = 0.001%. Combined with single-use tokens (one wrong
// guess at a time, but valid OTPs are deleted on success), this gives the
// brute-force protection that the spec implies.
const OTP_VERIFY_LIMIT: RateLimitOptions = {
  max: 10,
  windowMs: OTP_TTL_MS,
};

export async function verifyEmailOtpAction(rawInput: unknown): Promise<VerifyEmailOtpResult> {
  const parsed = verifyEmailOtpSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      formError: parsed.error.issues[0]?.message ?? "Enter the 6-digit code.",
    };
  }

  const { email, code } = parsed.data;
  const ip = getClientIp(await headers());

  // Per-email AND per-IP buckets so a single attacker can't share rate
  // budget across many emails by switching one of the two.
  if (!consumeRateLimit(`otp-verify:${email}`, OTP_VERIFY_LIMIT)) {
    return { ok: false, formError: "Too many attempts. Wait for a new code and try again." };
  }
  if (!consumeRateLimit(`otp-verify-ip:${ip}`, { max: 30, windowMs: OTP_TTL_MS })) {
    return { ok: false, formError: "Too many attempts. Try again in a few minutes." };
  }

  const result = await verifyOtp({ email, code });
  if (!result.ok) {
    if (result.reason === "expired") {
      return { ok: false, formError: "This code has expired. Send a new one." };
    }
    if (result.reason === "not-found") {
      return { ok: false, formError: "No verification in progress. Sign up again." };
    }
    return { ok: false, formError: "That code didn't match. Check it and try again." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, deletedAt: true, emailVerifiedAt: true },
  });
  if (!user || user.deletedAt) {
    return { ok: false, formError: "Account not found. Please sign up again." };
  }
  if (!user.emailVerifiedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  return { ok: true };
}

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
  if (!consumeRateLimit(`otp-resend:${email}:${ip}`)) {
    return { ok: false, formError: "Please wait a minute before requesting another code." };
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
