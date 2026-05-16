// Simulates the PostgreSQL atomic upsert behavior in-memory so we can
// unit-test the rate limiter without a real database.

const fakeBuckets = new Map<string, { count: number; resetAt: number }>();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(async (..._args: unknown[]) => {
      // The tagged template call from consumeRateLimit passes parameters
      // via Prisma's sql template. We extract them from the raw call args.
      // Args: [TemplateStringsArray, key, resetAt, resetAt, max]
      const args = _args as [TemplateStringsArray, ...unknown[]];
      const key = args[1] as string;
      const resetAt = args[2] as Date;
      const max = args[4] as number;

      const now = Date.now();
      const bucket = fakeBuckets.get(key);

      if (!bucket || bucket.resetAt <= now) {
        fakeBuckets.set(key, { count: 1, resetAt: resetAt.getTime() });
        return [{ count: 1 }];
      }

      if (bucket.count >= max) {
        return [];
      }

      bucket.count += 1;
      return [{ count: bucket.count }];
    }),
    rateLimitBucket: {
      deleteMany: jest.fn(async ({ where }: { where?: { key?: string } } = {}) => {
        if (where?.key) {
          fakeBuckets.delete(where.key);
        } else {
          fakeBuckets.clear();
        }
      }),
    },
  },
}));

import {
  __testing,
  clearRateLimit,
  consumeRateLimit,
  getClientIp,
} from "@/server/auth/rate-limit";

beforeEach(async () => {
  fakeBuckets.clear();
});

describe("consumeRateLimit", () => {
  it("allows up to MAX_ATTEMPTS within the window then blocks further attempts", async () => {
    const key = "login:user@example.com:1.2.3.4";
    for (let i = 0; i < __testing.MAX_ATTEMPTS; i += 1) {
      expect(await consumeRateLimit(key)).toBe(true);
    }
    expect(await consumeRateLimit(key)).toBe(false);
    expect(await consumeRateLimit(key)).toBe(false);
  });

  it("treats different keys independently", async () => {
    const a = "login:a@example.com:1.2.3.4";
    const b = "login:b@example.com:1.2.3.4";
    for (let i = 0; i < __testing.MAX_ATTEMPTS; i += 1) await consumeRateLimit(a);
    expect(await consumeRateLimit(a)).toBe(false);
    expect(await consumeRateLimit(b)).toBe(true);
  });

  it("resets after the window elapses", async () => {
    const key = "login:user@example.com:1.2.3.4";
    for (let i = 0; i < __testing.MAX_ATTEMPTS; i += 1) await consumeRateLimit(key);
    expect(await consumeRateLimit(key)).toBe(false);

    // Simulate window expiration by backdating the bucket
    const bucket = fakeBuckets.get(key);
    if (bucket) bucket.resetAt = Date.now() - 1;

    expect(await consumeRateLimit(key)).toBe(true);
  });
});

describe("clearRateLimit", () => {
  it("frees the bucket so the next attempt is fresh", async () => {
    const key = "login:user@example.com:1.2.3.4";
    for (let i = 0; i < __testing.MAX_ATTEMPTS; i += 1) await consumeRateLimit(key);
    expect(await consumeRateLimit(key)).toBe(false);
    await clearRateLimit(key);
    expect(await consumeRateLimit(key)).toBe(true);
  });
});

describe("getClientIp", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request("https://example.com/", { headers });
  }

  it("returns the first hop from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = makeRequest({ "x-real-ip": "203.0.113.7" });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("returns 'unknown' when no proxy headers are set", () => {
    expect(getClientIp(makeRequest({}))).toBe("unknown");
  });

  it("returns 'unknown' when request is undefined", () => {
    expect(getClientIp(undefined)).toBe("unknown");
  });
});
