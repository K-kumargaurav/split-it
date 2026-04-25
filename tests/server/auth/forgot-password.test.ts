jest.mock("next/headers", () => ({
  headers: () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));

const findUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

const createVerificationToken = jest.fn();
jest.mock("@/server/auth/tokens", () => ({
  createVerificationToken: (...args: unknown[]) => createVerificationToken(...args),
}));

const sendPasswordResetEmail = jest.fn();
jest.mock("@/server/email/auth-emails", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));

import { forgotPasswordAction } from "@/server/auth/forgot-password";
import { __testing as rateTesting } from "@/server/auth/rate-limit";

beforeEach(() => {
  jest.clearAllMocks();
  rateTesting.reset();
  createVerificationToken.mockResolvedValue("rawtoken");
});

describe("forgotPasswordAction", () => {
  it("rejects an invalid email", async () => {
    const result = await forgotPasswordAction({ email: "nope" });
    expect(result.ok).toBe(false);
  });

  it("returns ok without sending when the user does not exist", async () => {
    findUnique.mockResolvedValue(null);
    const result = await forgotPasswordAction({ email: "asha@example.com" });
    expect(result).toEqual({ ok: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns ok without sending when the user has no passwordHash (OAuth-only)", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      displayName: "Asha",
      passwordHash: null,
      deletedAt: null,
    });
    const result = await forgotPasswordAction({ email: "asha@example.com" });
    expect(result).toEqual({ ok: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns ok without sending for soft-deleted accounts", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      displayName: "Asha",
      passwordHash: "h",
      deletedAt: new Date(),
    });
    const result = await forgotPasswordAction({ email: "asha@example.com" });
    expect(result).toEqual({ ok: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("issues a token and sends a reset email when the account is eligible", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      displayName: "Asha",
      passwordHash: "h",
      deletedAt: null,
    });
    const result = await forgotPasswordAction({ email: "asha@example.com" });
    expect(result).toEqual({ ok: true });
    expect(createVerificationToken).toHaveBeenCalledWith({
      identifier: "asha@example.com",
      purpose: "PASSWORD_RESET",
    });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "asha@example.com", rawToken: "rawtoken" }),
    );
  });

  it("rate-limits after MAX_ATTEMPTS for the same key", async () => {
    findUnique.mockResolvedValue(null);
    for (let i = 0; i < rateTesting.MAX_ATTEMPTS; i += 1) {
      const r = await forgotPasswordAction({ email: "asha@example.com" });
      expect(r.ok).toBe(true);
    }
    const blocked = await forgotPasswordAction({ email: "asha@example.com" });
    expect(blocked.ok).toBe(false);
    expect(blocked.formError).toMatch(/too many/i);
  });
});
