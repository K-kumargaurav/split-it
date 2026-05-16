"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";
import { createVerificationToken } from "@/server/auth/tokens";
import { sendPasswordResetEmail } from "@/server/email/auth-emails";

export interface ForgotPasswordResult {
  ok: boolean;
  formError?: string;
}

const GENERIC_OK: ForgotPasswordResult = { ok: true };

// Always returns ok: true unless rate-limited or input invalid. We do not leak
// whether the email exists. A real email is sent only if the account exists,
// is not soft-deleted, and has a passwordHash (OAuth-only accounts cannot
// reset a password they never set).
export async function forgotPasswordAction(rawInput: unknown): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, formError: "Enter a valid email address." };
  }

  const ip = getClientIp(await headers());
  const rateKey = `forgot-pw:${parsed.data.email}:${ip}`;
  if (!(await consumeRateLimit(rateKey))) {
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
      passwordHash: true,
      deletedAt: true,
    },
  });
  if (!user || user.deletedAt || !user.passwordHash) {
    return GENERIC_OK;
  }

  try {
    const token = await createVerificationToken({
      identifier: parsed.data.email,
      purpose: "PASSWORD_RESET",
    });
    await sendPasswordResetEmail({
      to: parsed.data.email,
      displayName: user.displayName,
      rawToken: token,
    });
  } catch (err) {
    console.error("forgotPasswordAction failed", err);
    return { ok: false, formError: "Could not send email right now. Try again shortly." };
  }

  return GENERIC_OK;
}
