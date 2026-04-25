"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { hashPassword } from "@/server/auth/password";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";
import { consumeVerificationToken } from "@/server/auth/tokens";

export interface ResetPasswordResult {
  ok: boolean;
  fieldErrors?: Partial<Record<keyof ResetPasswordInput, string>>;
  formError?: string;
  reason?: "invalid" | "expired";
}

export async function resetPasswordAction(rawInput: unknown): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: ResetPasswordResult["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "password" || key === "token") {
        fieldErrors[key] = fieldErrors[key] ?? issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  // Token submission is rate-limited per IP — separate from the email-based
  // forgot-password limit so a single attacker can't park on a guessed token.
  const ip = getClientIp(await headers());
  const rateKey = `reset-pw:${ip}`;
  if (!consumeRateLimit(rateKey)) {
    return {
      ok: false,
      formError: "Too many attempts. Please wait a minute and try again.",
    };
  }

  const consumed = await consumeVerificationToken({
    rawToken: parsed.data.token,
    purpose: "PASSWORD_RESET",
  });
  if (!consumed) {
    return { ok: false, reason: "invalid" };
  }

  const user = await prisma.user.findUnique({
    where: { email: consumed.identifier },
    select: { id: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    return { ok: false, reason: "invalid" };
  }

  const newHash = await hashPassword(parsed.data.password);
  // Successful reset implies the user controls the inbox, so emailVerifiedAt
  // can be set if it wasn't already (e.g. a stale unverified row that the
  // attacker also can't reach without inbox access).
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, emailVerifiedAt: new Date() },
  });
  return { ok: true };
}
