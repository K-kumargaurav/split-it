"use server";

import { headers } from "next/headers";

import { signIn } from "@/lib/auth";
import { magicLinkSchema } from "@/lib/validations/auth";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";

export interface MagicLinkResult {
  ok: boolean;
  formError?: string;
  fieldError?: string;
}

const GENERIC_OK: MagicLinkResult = { ok: true };

// Triggers the NextAuth Nodemailer (magic link) provider. We always return
// `ok: true` for valid email shapes — same shape regardless of whether the
// address is registered, to prevent account enumeration.
export async function requestMagicLink(rawInput: unknown): Promise<MagicLinkResult> {
  const parsed = magicLinkSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      fieldError: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    };
  }

  const ip = getClientIp(await headers());

  // Layer 1: per-IP cap regardless of email — prevents an attacker from
  // rotating the target address to get a fresh bucket on every request.
  if (!consumeRateLimit(`magic-link-ip:${ip}`, { max: 5, windowMs: 60_000 })) {
    return {
      ok: false,
      formError: "Too many sign-in link requests. Please wait a minute and try again.",
    };
  }

  // Layer 2: per-recipient cap — limits how many magic-link emails any single
  // inbox can receive per hour, regardless of which IP is sending them.
  // Prevents mail-bombing a victim address from many IPs.
  if (
    !consumeRateLimit(`magic-link-victim:${parsed.data.email}`, {
      max: 3,
      windowMs: 60 * 60_000,
    })
  ) {
    return {
      ok: false,
      formError: "Too many sign-in link requests. Please wait a minute and try again.",
    };
  }

  try {
    // `redirect: false` returns a result object instead of throwing the
    // NextAuth redirect — keeps the server action returning a value the form
    // can react to inline.
    await signIn("nodemailer", {
      email: parsed.data.email,
      redirect: false,
    });
  } catch (err) {
    console.error("requestMagicLink failed", err);
    return {
      ok: false,
      formError: "Couldn't send the link. Please try again.",
    };
  }

  return GENERIC_OK;
}
