// tokens.ts imports `@/lib/prisma`, which would instantiate a real client at
// module-load and demand DATABASE_URL. Stub it — these tests only cover the
// pure helpers (generate / hash / TTL constants).
jest.mock("@/lib/prisma", () => ({ prisma: {} }));

import { generateRawToken, hashToken, TOKEN_TTL_MS } from "@/server/auth/tokens";

describe("generateRawToken", () => {
  it("produces a base64url string of usable length", () => {
    const t = generateRawToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bytes → ~43 base64url chars (no padding)
    expect(t.length).toBeGreaterThanOrEqual(40);
  });

  it("returns a different token on each call", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
  });
});

describe("hashToken", () => {
  it("returns a 64-char hex sha256", () => {
    const h = hashToken("abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("differs for different inputs", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("TOKEN_TTL_MS", () => {
  it("uses 24h for email verification and 1h for password reset", () => {
    expect(TOKEN_TTL_MS.EMAIL_VERIFICATION).toBe(24 * 60 * 60 * 1000);
    expect(TOKEN_TTL_MS.PASSWORD_RESET).toBe(60 * 60 * 1000);
  });
});
