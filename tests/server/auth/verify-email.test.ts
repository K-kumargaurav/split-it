jest.mock("next/headers", () => ({
  headers: () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));

const findUnique = jest.fn();
const update = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ count: 1 }]),
    rateLimitBucket: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  },
}));

const consumeVerificationToken = jest.fn();
const createVerificationToken = jest.fn();
jest.mock("@/server/auth/tokens", () => ({
  consumeVerificationToken: (...args: unknown[]) => consumeVerificationToken(...args),
  createVerificationToken: (...args: unknown[]) => createVerificationToken(...args),
}));

const sendVerificationEmail = jest.fn();
jest.mock("@/server/email/auth-emails", () => ({
  sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args),
}));

import { __testing as rateTesting } from "@/server/auth/rate-limit";
import {
  resendVerificationAction,
  verifyEmailAction,
} from "@/server/auth/verify-email";

beforeEach(() => {
  jest.clearAllMocks();
  rateTesting.reset();
});

describe("verifyEmailAction", () => {
  it("rejects when the token is missing", async () => {
    const result = await verifyEmailAction({ token: "" });
    expect(result).toEqual({ ok: false, reason: "validation" });
  });

  it("rejects when the token is unknown / expired", async () => {
    consumeVerificationToken.mockResolvedValue(null);
    const result = await verifyEmailAction({ token: "abc" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects when the user no longer exists", async () => {
    consumeVerificationToken.mockResolvedValue({ identifier: "asha@example.com" });
    findUnique.mockResolvedValue(null);
    const result = await verifyEmailAction({ token: "abc" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("is idempotent — returns ok if already verified", async () => {
    consumeVerificationToken.mockResolvedValue({ identifier: "asha@example.com" });
    findUnique.mockResolvedValue({
      id: "u1",
      deletedAt: null,
      emailVerifiedAt: new Date(),
    });
    const result = await verifyEmailAction({ token: "abc" });
    expect(result).toEqual({ ok: true });
    expect(update).not.toHaveBeenCalled();
  });

  it("sets emailVerifiedAt on success", async () => {
    consumeVerificationToken.mockResolvedValue({ identifier: "asha@example.com" });
    findUnique.mockResolvedValue({ id: "u1", deletedAt: null, emailVerifiedAt: null });
    update.mockResolvedValue({ id: "u1" });
    const result = await verifyEmailAction({ token: "abc" });
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });
});

describe("resendVerificationAction", () => {
  it("rejects an invalid email", async () => {
    const result = await resendVerificationAction({ email: "nope" });
    expect(result.ok).toBe(false);
  });

  it("returns ok without sending when the user does not exist (no enumeration)", async () => {
    findUnique.mockResolvedValue(null);
    const result = await resendVerificationAction({ email: "asha@example.com" });
    expect(result).toEqual({ ok: true });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns ok without sending when the user is already verified", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      displayName: "Asha",
      emailVerifiedAt: new Date(),
      deletedAt: null,
    });
    const result = await resendVerificationAction({ email: "asha@example.com" });
    expect(result).toEqual({ ok: true });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends a fresh email when the user is unverified", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      displayName: "Asha",
      emailVerifiedAt: null,
      deletedAt: null,
    });
    createVerificationToken.mockResolvedValue("freshtoken");
    const result = await resendVerificationAction({ email: "asha@example.com" });
    expect(result).toEqual({ ok: true });
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "asha@example.com", rawToken: "freshtoken" }),
    );
  });
});
