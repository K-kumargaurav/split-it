import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

// Single source of truth for User row creation. Every authentication provider
// (Google OAuth, magic link, OTP, password credentials) lands here so there's
// exactly one place that decides:
//   - the canonical email format (lowercased)
//   - the initial display name fallback
//   - whether emailVerifiedAt is set on first sign-in
//   - how a handle is allocated for new accounts
//
// Provider-specific verification semantics (per CLAUDE.md auth rules):
//   google       — Google guarantees the email is verified, so we mark it.
//   magic-link   — clicking the link proves inbox ownership, mark verified.
//   otp          — entering the 6-digit code proves inbox ownership.
//   credentials  — password alone proves nothing; the user must complete a
//                  separate email verification step before this turns true.
//
// Callers MAY pass `emailVerified: false` to force the unverified branch
// (the credentials path uses this even though the default is already false).

export type UpsertProvider = "google" | "magic-link" | "otp" | "credentials";

export interface UpsertUserInput {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: UpsertProvider;
  emailVerified?: boolean;
  // Optional fields used by the credentials registration flow, where the
  // user picks their own handle and supplies a password to be stored. Other
  // providers leave these undefined and accept auto-generation.
  handle?: string;
  passwordHash?: string;
}

export interface UpsertedUser {
  id: string;
  email: string | null;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  deletedAt: Date | null;
}

export async function upsertUser(input: UpsertUserInput): Promise<UpsertedUser> {
  const email = input.email.trim().toLowerCase();
  if (email.length === 0) {
    throw new Error("upsertUser requires a non-empty email.");
  }

  const shouldVerify = resolveVerified(input);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      deletedAt: true,
    },
  });

  if (existing) {
    // Update path. We do NOT touch handle / passwordHash for an existing
    // account — those are user-controlled identity fields and must not be
    // silently overwritten by a fresh sign-in. We DO opportunistically fill
    // in displayName / avatarUrl when the row was created without them, and
    // we backfill emailVerifiedAt when the current provider proves it.
    const data: {
      displayName?: string;
      avatarUrl?: string | null;
      emailVerifiedAt?: Date;
    } = {};

    const trimmedName = input.name?.trim();
    if (trimmedName && !existing.displayName) {
      data.displayName = trimmedName;
    }
    if (input.image && !existing.avatarUrl) {
      data.avatarUrl = input.image;
    }
    if (shouldVerify && !existing.emailVerifiedAt && !existing.deletedAt) {
      data.emailVerifiedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      return existing;
    }

    return prisma.user.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        email: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        deletedAt: true,
      },
    });
  }

  // Create path. Determine the handle: caller-supplied wins (credentials
  // registration), otherwise auto-generate from the display name with an
  // email-local-part fallback. Both paths re-check uniqueness.
  const handle =
    input.handle && (await isHandleFree(input.handle))
      ? input.handle
      : await generateHandleFrom(input.name ?? null, email);

  const displayName = (input.name?.trim() || email.split("@")[0]) ?? email;

  return prisma.user.create({
    data: {
      email,
      handle,
      displayName,
      avatarUrl: input.image ?? null,
      passwordHash: input.passwordHash ?? null,
      emailVerifiedAt: shouldVerify ? new Date() : null,
    },
    select: {
      id: true,
      email: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      deletedAt: true,
    },
  });
}

function resolveVerified(input: UpsertUserInput): boolean {
  if (typeof input.emailVerified === "boolean") return input.emailVerified;
  switch (input.provider) {
    case "google":
    case "magic-link":
    case "otp":
      return true;
    case "credentials":
      return false;
  }
}

async function isHandleFree(handle: string): Promise<boolean> {
  const taken = await prisma.user.findUnique({
    where: { handle },
    select: { id: true },
  });
  return !taken;
}

// Slug builder: prefer the supplied name, fall back to email local part.
// Lowercase a-z0-9 + underscores only — matches the public handle grammar
// (see handleSchema in src/lib/validations/auth.ts).
function slugify(source: string): string {
  return source
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 20);
}

async function generateHandleFrom(
  name: string | null,
  email: string,
): Promise<string> {
  const fromName = name ? slugify(name) : "";
  const fromEmail = slugify(email.split("@")[0] ?? "user");
  let base =
    fromName.length >= 3
      ? fromName
      : fromEmail.length >= 3
        ? fromEmail
        : `user${randomBytes(2).toString("hex")}`;

  // Handles must start with a letter (handleSchema). Prefix if necessary.
  if (!/^[a-z]/.test(base)) base = `u_${base}`.slice(0, 20);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base}_${randomBytes(3).toString("hex")}`.slice(0, 20);
    if (await isHandleFree(candidate)) return candidate;
  }
  return `${base}_${randomBytes(6).toString("hex")}`.slice(0, 20);
}
