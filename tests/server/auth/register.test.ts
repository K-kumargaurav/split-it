jest.mock("next/headers", () => ({
  headers: () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));

const findUnique = jest.fn();
const create = jest.fn();
const update = jest.fn();
const queryRaw = jest.fn();
const rateLimitDeleteMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
    },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
    rateLimitBucket: { deleteMany: (...args: unknown[]) => rateLimitDeleteMany(...args) },
  },
}));

const sendEmailOtpEmail = jest.fn();
const sendVerificationEmail = jest.fn();
jest.mock("@/server/email/auth-emails", () => ({
  sendEmailOtpEmail: (...args: unknown[]) => sendEmailOtpEmail(...args),
  sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args),
}));

const createEmailOtp = jest.fn();
jest.mock("@/server/auth/email-otp", () => ({
  OTP_TTL_MS: 15 * 60 * 1000,
  createEmailOtp: (...args: unknown[]) => createEmailOtp(...args),
}));

const allocateHandle = jest.fn();
const generateUniqueHandle = jest.fn();
jest.mock("@/server/auth/handle", () => ({
  allocateHandle: (...args: unknown[]) => allocateHandle(...args),
  generateUniqueHandle: (...args: unknown[]) => generateUniqueHandle(...args),
}));

import { __testing as rateTesting } from "@/server/auth/rate-limit";
import { registerAction } from "@/server/auth/register";

beforeEach(() => {
  jest.clearAllMocks();
  queryRaw.mockResolvedValue([{ count: 1 }]);
  rateLimitDeleteMany.mockResolvedValue({ count: 0 });
  rateTesting.reset();
  allocateHandle.mockResolvedValue("asha");
  generateUniqueHandle.mockResolvedValue("asha");
  createEmailOtp.mockResolvedValue("123456");
  sendEmailOtpEmail.mockResolvedValue(undefined);
});

describe("registerAction validation", () => {
  it("returns fieldErrors for a weak password", async () => {
    const result = await registerAction({
      email: "user@example.com",
      password: "short",
      displayName: "Asha",
      handle: "asha_p",
    });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.password).toBeDefined();
  });

  it("returns fieldErrors for an invalid email", async () => {
    const result = await registerAction({
      email: "not-an-email",
      password: "Hunter22!",
      displayName: "Asha",
      handle: "asha_p",
    });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.email).toBeDefined();
  });

  it("returns fieldErrors when displayName is empty", async () => {
    const result = await registerAction({
      email: "user@example.com",
      password: "Hunter22!",
      displayName: "  ",
      handle: "asha_p",
    });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.displayName).toBeDefined();
  });

  it("returns a handle fieldError when the handle is malformed", async () => {
    const result = await registerAction({
      email: "user@example.com",
      password: "Hunter22!",
      displayName: "Asha",
      handle: "ab",
    });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.handle).toBeDefined();
  });
});

describe("registerAction provisioning paths", () => {
  it("creates a new user and dispatches a 6-digit OTP email", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "u1" });

    const result = await registerAction({
      email: "Asha@Example.com",
      password: "Hunter22!",
      displayName: "Asha",
      handle: "asha_p",
    });
    expect(result).toEqual({ ok: true, otpSent: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]?.data?.email).toBe("asha@example.com");
    expect(create.mock.calls[0][0]?.data?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(createEmailOtp).toHaveBeenCalledWith({ email: "asha@example.com" });
    expect(sendEmailOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "asha@example.com", code: "123456", ttlMinutes: 15 }),
    );
  });

  it("surfaces a duplicate-email field error when the account already has a password", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      displayName: "Asha",
      passwordHash: "existinghash",
      emailVerifiedAt: new Date(),
      deletedAt: null,
    });

    const result = await registerAction({
      email: "asha@example.com",
      password: "Hunter22!",
      displayName: "Asha",
      handle: "asha_p",
    });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.email).toMatch(/already exists/i);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(sendEmailOtpEmail).not.toHaveBeenCalled();
  });

  it("links a password to an OAuth-only account and sends OTP when email is unverified", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      displayName: "Asha",
      passwordHash: null,
      emailVerifiedAt: null,
      deletedAt: null,
    });
    update.mockResolvedValue({ id: "u1" });

    const result = await registerAction({
      email: "asha@example.com",
      password: "Hunter22!",
      displayName: "Asha",
      handle: "asha_p",
    });
    expect(result).toEqual({ ok: true, otpSent: true });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ passwordHash: expect.stringMatching(/^\$2[aby]\$12\$/) }),
    });
    expect(sendEmailOtpEmail).toHaveBeenCalled();
  });

  it("links a password to an already-verified OAuth account WITHOUT sending an OTP", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      displayName: "Asha",
      passwordHash: null,
      emailVerifiedAt: new Date(),
      deletedAt: null,
    });
    update.mockResolvedValue({ id: "u1" });

    const result = await registerAction({
      email: "asha@example.com",
      password: "Hunter22!",
      displayName: "Asha",
      handle: "asha_p",
    });
    expect(result).toEqual({ ok: true, otpSent: false });
    expect(update).toHaveBeenCalled();
    expect(sendEmailOtpEmail).not.toHaveBeenCalled();
  });

  it("blocks registration on a soft-deleted email squatter", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      displayName: "Asha",
      passwordHash: "h",
      emailVerifiedAt: new Date(),
      deletedAt: new Date(),
    });

    const result = await registerAction({
      email: "asha@example.com",
      password: "Hunter22!",
      displayName: "Asha",
      handle: "asha_p",
    });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.email).toBeDefined();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(sendEmailOtpEmail).not.toHaveBeenCalled();
  });
});

describe("registerAction rate limit", () => {
  it("blocks after MAX_ATTEMPTS within the window", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "u1" });

    // Simulate DB-backed rate limiter: allow first MAX_ATTEMPTS, then reject
    queryRaw.mockReset();
    for (let i = 0; i < rateTesting.MAX_ATTEMPTS; i += 1) {
      queryRaw.mockResolvedValueOnce([{ count: i + 1 }]);
    }
    queryRaw.mockResolvedValue([]); // after limit: WHERE clause rejects => empty result

    for (let i = 0; i < rateTesting.MAX_ATTEMPTS; i += 1) {
      const r = await registerAction({
        email: `u${i}@example.com`,
        password: "Hunter22!",
        displayName: "Asha",
        handle: `asha_${i}`,
      });
      expect(r.ok).toBe(true);
    }
    const blocked = await registerAction({
      email: "u-extra@example.com",
      password: "Hunter22!",
      displayName: "Asha",
      handle: "asha_p",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.formError).toMatch(/too many/i);
  });
});
