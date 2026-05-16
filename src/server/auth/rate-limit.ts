// PostgreSQL-backed fixed-window rate limiter for auth endpoints. Per CLAUDE.md:
// "Rate limit all auth endpoints (max 5 req/min)".
//
// Uses an atomic upsert so concurrent requests on multiple instances are
// correctly counted against the same bucket. Expired buckets are lazily
// reset on the next request (the CASE expression resets count to 1 when
// reset_at has passed). Old buckets are periodically cleaned up.

import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

export interface RateLimitOptions {
  max?: number;
  windowMs?: number;
}

/**
 * Atomically consume one attempt from the rate-limit bucket for `key`.
 * Returns `true` if the request is allowed, `false` if rate-limited.
 */
export async function consumeRateLimit(
  key: string,
  options: RateLimitOptions = {},
): Promise<boolean> {
  const max = options.max ?? MAX_ATTEMPTS;
  const windowMs = options.windowMs ?? WINDOW_MS;
  const resetAt = new Date(Date.now() + windowMs);

  // Atomic upsert with conditional logic:
  //   - If the bucket doesn't exist → insert with count=1
  //   - If the bucket exists but is expired → reset count to 1, new window
  //   - If the bucket exists and is active → increment count
  //   - The WHERE clause rejects the update if count >= max AND not expired
  //     (i.e., rate-limited), so rowCount will be 0
  const result = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit_buckets (key, count, reset_at)
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT (key) DO UPDATE
      SET count = CASE
            WHEN rate_limit_buckets.reset_at <= NOW() THEN 1
            ELSE rate_limit_buckets.count + 1
          END,
          reset_at = CASE
            WHEN rate_limit_buckets.reset_at <= NOW() THEN ${resetAt}
            ELSE rate_limit_buckets.reset_at
          END
      WHERE rate_limit_buckets.reset_at <= NOW()
         OR rate_limit_buckets.count < ${max}
    RETURNING count
  `;

  return result.length > 0;
}

/**
 * Remove a rate-limit bucket (e.g., after successful login).
 */
export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}

export function getClientIp(source: Request | Headers | undefined): string {
  if (!source) return "unknown";
  const headers = source instanceof Headers ? source : source.headers;

  // Read platform-injected single-IP headers first — these are set by the
  // trusted edge and cannot be spoofed by the client.
  const flyIp = headers.get("fly-client-ip");
  if (flyIp) return flyIp.trim();

  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

export const __testing = {
  async reset(): Promise<void> {
    await prisma.rateLimitBucket.deleteMany();
  },
  WINDOW_MS,
  MAX_ATTEMPTS,
};
