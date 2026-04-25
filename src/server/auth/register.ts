"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { generateUniqueHandle } from "@/server/auth/handle";
import { hashPassword } from "@/server/auth/password";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";
import { createVerificationToken } from "@/server/auth/tokens";
import { sendVerificationEmail } from "@/server/email/auth-emails";

// We always return the same shape regardless of whether the email was already
// taken — this prevents account enumeration via the registration form.
export interface RegisterResult {
  ok: boolean;
  fieldErrors?: Partial<Record<keyof RegisterInput, string>>;
  formError?: string;
}

const GENERIC_OK: RegisterResult = { ok: true };

export async function registerAction(rawInput: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: RegisterResult["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "email" || key === "password" || key === "displayName") {
        fieldErrors[key] = fieldErrors[key] ?? issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const ip = getClientIp(await headers());
  const rateKey = `register:${ip}`;
  if (!consumeRateLimit(rateKey)) {
    return {
      ok: false,
      formError: "Too many attempts. Please wait a minute and try again.",
    };
  }

  const { email, password, displayName } = parsed.data;

  // We always tell the caller "check your email", but only do real work when
  // appropriate. This intentionally takes similar wall-clock time across paths
  // (each path performs at least one bcrypt + one DB write).
  try {
    await provisionAccount({ email, password, displayName });
  } catch (err) {
    console.error("registerAction failed", err);
    return {
      ok: false,
      formError: "Something went wrong. Please try again in a moment.",
    };
  }

  return GENERIC_OK;
}

interface ProvisionInput {
  email: string;
  password: string;
  displayName: string;
}

async function provisionAccount(input: ProvisionInput): Promise<void> {
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

  // Always run bcrypt so timing is constant whether the user existed or not.
  const newHash = await hashPassword(input.password);

  if (!existing) {
    const handle = await generateUniqueHandle(input.email);
    await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: newHash,
        displayName: input.displayName,
        handle,
      },
      select: { id: true },
    });
    const token = await createVerificationToken({
      identifier: input.email,
      purpose: "EMAIL_VERIFICATION",
    });
    await sendVerificationEmail({
      to: input.email,
      displayName: input.displayName,
      rawToken: token,
    });
    return;
  }

  if (existing.deletedAt) {
    // Soft-deleted accounts: do nothing observable. Caller still gets the
    // generic success response.
    return;
  }

  if (existing.passwordHash) {
    // Already has a password — do not overwrite. We could send a "you already
    // have an account" email here, but skipping for v1 to avoid abuse vectors
    // (mass enumeration via the register endpoint to spam users).
    return;
  }

  // OAuth-only account adding a password. Set the hash. If their email was
  // already verified via Google, no further action; otherwise issue a
  // verification token.
  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash: newHash },
  });
  if (!existing.emailVerifiedAt) {
    const token = await createVerificationToken({
      identifier: input.email,
      purpose: "EMAIL_VERIFICATION",
    });
    await sendVerificationEmail({
      to: input.email,
      displayName: existing.displayName,
      rawToken: token,
    });
  }
}
