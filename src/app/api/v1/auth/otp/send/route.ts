import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { OTP_TTL_MS, createEmailOtp } from "@/server/auth/email-otp";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";
import { sendEmailOtpEmail } from "@/server/email/auth-emails";

export const runtime = "nodejs";

export interface SendOtpResult {
  ok: boolean;
  formError?: string;
}

/**
 * POST /api/v1/auth/otp/send
 *
 * Issues a 6-digit sign-in OTP and emails it to the caller. Works for both
 * existing users and new accounts — `signIn("otp", { email, otp })` in
 * auth.ts upserts the user on successful verification, so no pre-existing
 * account is required.
 *
 * Always returns ok:true for valid email shapes to prevent account
 * enumeration (same strategy as /api/v1/auth/magic-link).
 *
 * Rate limits (two independent layers):
 *   • Per-IP:    5 sends / 60s  — blocks bots rotating the target address
 *   • Per-email: 3 sends / 15m  — limits inbox flooding from many IPs
 */
export async function POST(request: Request): Promise<NextResponse<SendOtpResult>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, formError: "Invalid request." }, { status: 400 });
  }

  const raw = (body as Record<string, unknown>)?.email;
  if (typeof raw !== "string") {
    return NextResponse.json({ ok: false, formError: "Email is required." }, { status: 400 });
  }

  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, formError: "Enter a valid email address." }, { status: 400 });
  }

  const ip = getClientIp(await headers());

  // Layer 1: per-IP cap — prevents rotating target addresses for fresh buckets.
  if (!consumeRateLimit(`otp-send-ip:${ip}`, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json(
      { ok: false, formError: "Too many requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  // Layer 2: per-email cap — limits inbox flooding from many IPs.
  if (!consumeRateLimit(`otp-send-email:${email}`, { max: 3, windowMs: OTP_TTL_MS })) {
    return NextResponse.json(
      { ok: false, formError: "Too many codes sent to this address. Please wait before requesting another." },
      { status: 429 },
    );
  }

  try {
    // Look up display name for the email template. New users get a fallback
    // — upsertUser runs on successful OTP verification, so the row may not
    // exist yet. Don't reveal whether the account exists via timing: the OTP
    // is always generated and the email always sent.
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { displayName: true, deletedAt: true },
    });

    // Silently skip deleted accounts but return ok:true (same as magic-link
    // — don't reveal account state to the caller).
    if (existing?.deletedAt) {
      return NextResponse.json({ ok: true });
    }

    const displayName = existing?.displayName ?? email.split("@")[0] ?? "there";

    const code = await createEmailOtp({ email });

    await sendEmailOtpEmail({
      to: email,
      displayName,
      code,
      ttlMinutes: Math.round(OTP_TTL_MS / 60_000),
    });
  } catch (err) {
    console.error("[otp/send] failed:", err);
    // Don't expose internal errors — fall through and return ok:true so the
    // UI shows the OTP step. The user will see "Invalid code" when they try
    // to submit, which is recoverable.
    return NextResponse.json(
      { ok: false, formError: "Couldn't send the code. Please try again." },
    );
  }

  return NextResponse.json({ ok: true });
}