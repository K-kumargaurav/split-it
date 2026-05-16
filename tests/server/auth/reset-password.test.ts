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
jest.mock("@/server/auth/tokens", () => ({
  consumeVerificationToken: (...args: unknown[]) => consumeVerificationToken(...args),
}));

import { __testing as rateTesting } from "@/server/auth/rate-limit";
import { resetPasswordAction } from "@/server/auth/reset-password";

beforeEach(() => {
  jest.clearAllMocks();
  rateTesting.reset();
});

describe("resetPasswordAction", () => {
  it("rejects when the password is too weak", async () => {
    const result = await resetPasswordAction({ token: "abc", password: "weak" });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.password).toBeDefined();
  });

  it("rejects when the token is missing", async () => {
    const result = await resetPasswordAction({ token: "", password: "Hunter22!" });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.token).toBeDefined();
  });

  it("returns reason: invalid for an unknown token", async () => {
    consumeVerificationToken.mockResolvedValue(null);
    const result = await resetPasswordAction({ token: "abc", password: "Hunter22!" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns reason: invalid when the user is gone or soft-deleted", async () => {
    consumeVerificationToken.mockResolvedValue({ identifier: "asha@example.com" });
    findUnique.mockResolvedValue(null);
    expect(await resetPasswordAction({ token: "abc", password: "Hunter22!" })).toEqual({
      ok: false,
      reason: "invalid",
    });

    findUnique.mockResolvedValue({ id: "u1", deletedAt: new Date() });
    expect(await resetPasswordAction({ token: "abc", password: "Hunter22!" })).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("hashes the new password and sets emailVerifiedAt on success", async () => {
    consumeVerificationToken.mockResolvedValue({ identifier: "asha@example.com" });
    findUnique.mockResolvedValue({ id: "u1", deletedAt: null });
    update.mockResolvedValue({ id: "u1" });

    const result = await resetPasswordAction({ token: "abc", password: "Hunter22!" });
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        passwordHash: expect.stringMatching(/^\$2[aby]\$12\$/),
        emailVerifiedAt: expect.any(Date),
      },
    });
  });
});
