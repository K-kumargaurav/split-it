import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { VerificationPurpose } from "@/generated/prisma";

const RAW_TOKEN_BYTES = 32;

export const TOKEN_TTL_MS: Record<VerificationPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24h
  PASSWORD_RESET: 60 * 60 * 1000, // 1h
};

export function generateRawToken(): string {
  return randomBytes(RAW_TOKEN_BYTES).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

interface CreateInput {
  identifier: string;
  purpose: VerificationPurpose;
}

// Issues a single-use token. We store only the SHA-256 hash so a DB read does
// not yield active links. There can be at most one outstanding token per
// (identifier, purpose) — issuing a new one supersedes the old.
export async function createVerificationToken(input: CreateInput): Promise<string> {
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expires = new Date(Date.now() + TOKEN_TTL_MS[input.purpose]);
  await prisma.verificationToken.upsert({
    where: {
      identifier_purpose: { identifier: input.identifier, purpose: input.purpose },
    },
    create: {
      identifier: input.identifier,
      purpose: input.purpose,
      tokenHash,
      expires,
    },
    update: { tokenHash, expires, createdAt: new Date() },
  });
  return raw;
}

interface ConsumeInput {
  rawToken: string;
  purpose: VerificationPurpose;
}

export interface ConsumedToken {
  identifier: string;
}

// Looks up by hash + purpose, then deletes the row before returning. The delete
// happens in the same transaction-shaped flow so a token cannot be redeemed
// twice. Returns null when missing, expired, or for the wrong purpose.
export async function consumeVerificationToken(
  input: ConsumeInput,
): Promise<ConsumedToken | null> {
  const tokenHash = hashToken(input.rawToken);
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash },
    select: { identifier: true, purpose: true, expires: true },
  });
  if (!record || record.purpose !== input.purpose) return null;
  if (record.expires.getTime() <= Date.now()) {
    await prisma.verificationToken
      .delete({ where: { tokenHash } })
      .catch(() => undefined);
    return null;
  }
  // Best-effort delete — if a concurrent caller already consumed it, the
  // delete throws P2025 and we treat the token as already used.
  try {
    await prisma.verificationToken.delete({ where: { tokenHash } });
  } catch {
    return null;
  }
  return { identifier: record.identifier };
}

export async function invalidateTokensFor(
  identifier: string,
  purpose: VerificationPurpose,
): Promise<void> {
  await prisma.verificationToken
    .delete({
      where: { identifier_purpose: { identifier, purpose } },
    })
    .catch(() => undefined);
}
