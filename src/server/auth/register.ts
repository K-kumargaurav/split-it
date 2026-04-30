"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { OTP_TTL_MS, createEmailOtp } from "@/server/auth/email-otp";
import { hashPassword } from "@/server/auth/password";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";
import { upsertUser } from "@/server/auth/upsert-user";
import { sendEmailOtpEmail } from "@/server/email/auth-emails";

// Result shapes:
//   • { ok: true, otpSent: true }           — new account or OAuth-link path:
//                                             OTP is on the way; client should
//                                             transition to OTP_SENT state.
//   • { ok: true, otpSent: false }          — already-verified OAuth account
//                                             linked to a password; no OTP.
//                                             Client can sign in directly.
//   • { ok: false, fieldErrors.email: ... } — duplicate email with password
//                                             set. Client surfaces "already
//                                             registered, sign in instead".
export interface RegisterResult {
  ok: boolean;
  otpSent?: boolean;
  fieldErrors?: Partial<Record<keyof RegisterInput, string>>;
  formError?: string;
}

export async function registerAction(rawInput: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: RegisterResult["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (
        key === "email" ||
        key === "password" ||
        key === "displayName" ||
        key === "handle"
      ) {
        fieldErrors[key] = fieldErrors[key] ?? issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const ip = getClientIp(await headers());
  if (!consumeRateLimit(`register:${ip}`)) {
    return {
      ok: false,
      formError: "Too many attempts. Please wait a minute and try again.",
    };
  }

  const { email, password, displayName, handle } = parsed.data;

  try {
    return await provisionAccount({ email, password, displayName, handle });
  } catch (err) {
    console.error("registerAction failed", err);
    return {
      ok: false,
      formError: "Something went wrong. Please try again in a moment.",
    };
  }
}

interface ProvisionInput {
  email: string;
  password: string;
  displayName: string;
  handle: string;
}

async function provisionAccount(input: ProvisionInput): Promise<RegisterResult> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      displayName: true,
      passwordHash: true,
      emailVerifiedAt: true,
      deletedAt: true,
    },
  });

  // Always run bcrypt so timing on the "duplicate email" path stays close to
  // the create / OAuth-link paths.
  const newHash = await hashPassword(input.password);

  if (!existing || existing.deletedAt) {
    if (existing?.deletedAt) {
      // Soft-deleted record squatting on this email. Per §2.4 the email is
      // null'd on delete so this branch is mostly defensive — but the user
      // can't claim it. Treat as "duplicate" without leaking why.
      return {
        ok: false,
        fieldErrors: { email: "This email isn't available." },
      };
    }
    // upsertUser is the single source of truth for User creation. The
    // credentials path never sets emailVerifiedAt — the user must complete
    // the OTP step that follows.
    await upsertUser({
      email: input.email,
      name: input.displayName,
      provider: "credentials",
      emailVerified: false,
      handle: input.handle,
      passwordHash: newHash,
    });
    const code = await createEmailOtp({ email: input.email });
    await sendEmailOtpEmail({
      to: input.email,
      displayName: input.displayName,
      code,
      ttlMinutes: Math.round(OTP_TTL_MS / 60_000),
    });
    return { ok: true, otpSent: true };
  }

  if (existing.passwordHash) {
    // Active account already has a password — block. The user is steered
    // to /login. (This is the case the new check-email flow surfaces; we
    // re-check here to close the race between client check and submit.)
    return {
      ok: false,
      fieldErrors: {
        email: "An account with this email already exists.",
      },
    };
  }

  // OAuth-only account adding a password. Link the hash. If the email was
  // already verified via Google, sign-in can proceed immediately; otherwise
  // issue an OTP.
  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash: newHash },
  });

  if (existing.emailVerifiedAt) {
    return { ok: true, otpSent: false };
  }

  const code = await createEmailOtp({ email: input.email });
  await sendEmailOtpEmail({
    to: input.email,
    displayName: existing.displayName,
    code,
    ttlMinutes: Math.round(OTP_TTL_MS / 60_000),
  });
  return { ok: true, otpSent: true };
}
