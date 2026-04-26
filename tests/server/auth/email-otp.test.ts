const upsert = jest.fn();
const findUnique = jest.fn();
const del = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: {
      upsert: (...args: unknown[]) => upsert(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      delete: (...args: unknown[]) => del(...args),
    },
  },
}));

import {
  OTP_TTL_MS,
  createEmailOtp,
  generateOtp,
  hashOtp,
  verifyEmailOtp,
} from "@/server/auth/email-otp";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateOtp", () => {
  it("returns a 6-digit numeric string with leading zeros preserved", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateOtp();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashOtp", () => {
  it("derives a stable, deterministic hash for a given (email, code)", () => {
    const a = hashOtp("asha@example.com", "123456");
    const b = hashOtp("asha@example.com", "123456");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("salts with email so the same OTP for two users yields different hashes", () => {
    const a = hashOtp("asha@example.com", "123456");
    const b = hashOtp("ravi@example.com", "123456");
    expect(a).not.toBe(b);
  });

  it("normalises email case so 'Asha@…' and 'asha@…' hash identically", () => {
    expect(hashOtp("Asha@Example.com", "123456")).toBe(hashOtp("asha@example.com", "123456"));
  });
});

describe("createEmailOtp", () => {
  it("upserts a verification token row keyed by (identifier, EMAIL_VERIFICATION) and returns the raw code", async () => {
    upsert.mockResolvedValue(undefined);
    const code = await createEmailOtp({ email: "asha@example.com" });
    expect(code).toMatch(/^\d{6}$/);
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.where.identifier_purpose).toEqual({
      identifier: "asha@example.com",
      purpose: "EMAIL_VERIFICATION",
    });
    expect(arg.create.tokenHash).toBe(hashOtp("asha@example.com", code));
    // 15-minute TTL per SPEC §2.1.
    const ttlMs = (arg.create.expires as Date).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(OTP_TTL_MS - 5_000);
    expect(ttlMs).toBeLessThanOrEqual(OTP_TTL_MS + 1_000);
  });
});

describe("verifyEmailOtp", () => {
  it("accepts a matching, unexpired code and deletes the row", async () => {
    findUnique.mockResolvedValue({
      tokenHash: hashOtp("asha@example.com", "123456"),
      expires: new Date(Date.now() + 60_000),
    });
    del.mockResolvedValue(undefined);

    const result = await verifyEmailOtp({ email: "asha@example.com", code: "123456" });
    expect(result).toEqual({ ok: true });
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("returns invalid when the code does not match", async () => {
    findUnique.mockResolvedValue({
      tokenHash: hashOtp("asha@example.com", "123456"),
      expires: new Date(Date.now() + 60_000),
    });
    const result = await verifyEmailOtp({ email: "asha@example.com", code: "999999" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(del).not.toHaveBeenCalled();
  });

  it("returns expired when the row is past its TTL and best-effort-deletes it", async () => {
    findUnique.mockResolvedValue({
      tokenHash: hashOtp("asha@example.com", "123456"),
      expires: new Date(Date.now() - 1_000),
    });
    del.mockResolvedValue(undefined);
    const result = await verifyEmailOtp({ email: "asha@example.com", code: "123456" });
    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("returns not-found when no row exists for the email", async () => {
    findUnique.mockResolvedValue(null);
    const result = await verifyEmailOtp({ email: "asha@example.com", code: "123456" });
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns invalid if the delete races (concurrent redemption)", async () => {
    findUnique.mockResolvedValue({
      tokenHash: hashOtp("asha@example.com", "123456"),
      expires: new Date(Date.now() + 60_000),
    });
    del.mockRejectedValue(new Error("P2025: row not found"));
    const result = await verifyEmailOtp({ email: "asha@example.com", code: "123456" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });
});
