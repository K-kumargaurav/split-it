"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import {
  resendVerificationSchema,
  verifyEmailSchema,
} from "@/lib/validations/auth";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";
import {
  consumeVerificationToken,
  createVerificationToken,
} from "@/server/auth/tokens";
import { sendVerificationEmail } from "@/server/email/auth-emails";

export type VerifyEmailResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "validation" };

export async function verifyEmailAction(rawInput: unknown): Promise<VerifyEmailResult> {
  const parsed = verifyEmailSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, reason: "validation" };

  const consumed = await consumeVerificationToken({
    rawToken: parsed.data.token,
    purpose: "EMAIL_VERIFICATION",
  });
  if (!consumed) return { ok: false, reason: "invalid" };

  const user = await prisma.user.findUnique({
    where: { email: consumed.identifier },
    select: { id: true, deletedAt: true, emailVerifiedAt: true },
  });
  if (!user || user.deletedAt) return { ok: false, reason: "invalid" };
  if (user.emailVerifiedAt) return { ok: true };

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });
  return { ok: true };
}

export interface ResendVerificationResult {
  ok: boolean;
  formError?: string;
}

// Always returns ok: true unless rate-limited. Real send only happens when the
// account exists and is unverified.
export async function resendVerificationAction(
  rawInput: unknown,
): Promise<ResendVerificationResult> {
  const parsed = resendVerificationSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, formError: "Enter a valid email address." };
  }

  const ip = getClientIp(await headers());
  const rateKey = `resend-verify:${parsed.data.email}:${ip}`;
  if (!consumeRateLimit(rateKey)) {
    return {
      ok: false,
      formError: "Too many requests. Please wait a minute before trying again.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      displayName: true,
      emailVerifiedAt: true,
      deletedAt: true,
    },
  });
  if (!user || user.deletedAt || user.emailVerifiedAt) {
    return { ok: true };
  }

  try {
    const token = await createVerificationToken({
      identifier: parsed.data.email,
      purpose: "EMAIL_VERIFICATION",
    });
    await sendVerificationEmail({
      to: parsed.data.email,
      displayName: user.displayName,
      rawToken: token,
    });
  } catch (err) {
    console.error("resendVerificationAction failed", err);
    return { ok: false, formError: "Could not send email right now. Try again shortly." };
  }
  return { ok: true };
}
