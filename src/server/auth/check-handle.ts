"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { checkHandleSchema } from "@/lib/validations/auth";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";

export type HandleStatus = "available" | "taken" | "invalid" | "reserved" | "rate-limited";

export interface CheckHandleResult {
  status: HandleStatus;
  message: string;
}

// Reserved handles guard against impersonation of system endpoints, support
// channels, and routes that may exist in the future. Keep lowercase.
const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "dashboard",
  "groups",
  "help",
  "login",
  "logout",
  "me",
  "register",
  "root",
  "settings",
  "settle",
  "spliteasy",
  "splitwise",
  "support",
  "system",
  "team",
  "user",
  "users",
]);

export async function checkHandleAvailability(rawHandle: unknown): Promise<CheckHandleResult> {
  const parsed = checkHandleSchema.safeParse({ handle: rawHandle });
  if (!parsed.success) {
    return {
      status: "invalid",
      message: parsed.error.issues[0]?.message ?? "Invalid handle.",
    };
  }

  const { handle } = parsed.data;

  // Per-IP rate limit on the lookup endpoint — handle availability is a cheap
  // way to enumerate registered users otherwise.
  const ip = getClientIp(await headers());
  if (!consumeRateLimit(`handle-check:${ip}`, { max: 30, windowMs: 60_000 })) {
    return { status: "rate-limited", message: "Too many checks. Try again in a moment." };
  }

  if (RESERVED.has(handle)) {
    return { status: "reserved", message: "This handle is reserved." };
  }

  const taken = await prisma.user.findUnique({
    where: { handle },
    select: { id: true },
  });

  if (taken) {
    return { status: "taken", message: "This handle is already taken." };
  }
  return { status: "available", message: "Handle is available." };
}
