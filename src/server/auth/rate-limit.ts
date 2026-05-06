// In-memory fixed-window rate limiter for auth endpoints. Per CLAUDE.md:
// "Rate limit all auth endpoints (max 5 req/min)".
//
// Production caveat: this Map lives in a single Node process. On serverless
// (Vercel) each warm instance has its own counter, so the effective rate is
// MAX_ATTEMPTS × instances. Replace with Redis (e.g. @upstash/ratelimit) once
// the infra is wired up.

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const MAX_BUCKETS = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function gc(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}

export interface RateLimitOptions {
  max?: number;
  windowMs?: number;
}

export function consumeRateLimit(key: string, options: RateLimitOptions = {}): boolean {
  const max = options.max ?? MAX_ATTEMPTS;
  const windowMs = options.windowMs ?? WINDOW_MS;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    gc(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

export function getClientIp(source: Request | Headers | undefined): string {
  if (!source) return "unknown";
  const headers = source instanceof Headers ? source : source.headers;

  // Read platform-injected single-IP headers first — these are set by the
  // trusted edge and cannot be spoofed by the client.
  //   fly-client-ip    — Fly.io (set by the Fly proxy, always a single IP)
  //   cf-connecting-ip — Cloudflare (always a single real client IP)
  //   x-real-ip        — Railway and nginx reverse proxies (single IP)
  const flyIp = headers.get("fly-client-ip");
  if (flyIp) return flyIp.trim();

  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Railway passes x-real-ip as the real client IP (not XFF).
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();

  // X-Forwarded-For fallback: "client, proxy1, proxy2, ...". We take the
  // FIRST entry because on generic setups the left-most non-private address
  // is the originating client. When none of the platform headers above were
  // set this is a best-effort heuristic.
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

export const __testing = {
  reset(): void {
    buckets.clear();
  },
  WINDOW_MS,
  MAX_ATTEMPTS,
};
