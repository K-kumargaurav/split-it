import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

// Slug derived from email local-part: lowercase a-z0-9, then padded to ≥3 to
// satisfy the same min-length contract as user-supplied handles.
function slugFromEmail(email: string): string {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
  if (base.length >= 3) return base;
  return `${base || "user"}${randomBytes(2).toString("hex")}`.slice(0, 20);
}

async function isHandleFree(handle: string): Promise<boolean> {
  const taken = await prisma.user.findUnique({
    where: { handle },
    select: { id: true },
  });
  return !taken;
}

// Allocates a handle for a new account. If the user supplied one (already
// validated and confirmed available client-side), we still re-verify here to
// race-safely catch the case where two users picked the same handle in the
// debounce window between availability check and submit.
export async function allocateHandle(opts: {
  desired?: string | null;
  fallbackEmail: string;
}): Promise<string> {
  if (opts.desired && (await isHandleFree(opts.desired))) {
    return opts.desired;
  }
  return generateUniqueHandle(opts.fallbackEmail);
}

// Auto-derive a unique handle when no user input is available (OAuth first
// sign-in, or fallback when the user's chosen handle was sniped between
// availability check and submit).
export async function generateUniqueHandle(email: string): Promise<string> {
  const base = slugFromEmail(email);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}_${randomBytes(3).toString("hex")}`;
    if (await isHandleFree(candidate)) return candidate;
  }
  return `${base}_${randomBytes(6).toString("hex")}`;
}
