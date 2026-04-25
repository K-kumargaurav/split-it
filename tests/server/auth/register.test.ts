jest.mock("next/headers", () => ({
  headers: () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));

const findUnique = jest.fn();
const create = jest.fn();
const update = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

const sendVerificationEmail = jest.fn();
jest.mock("@/server/email/auth-emails", () => ({
  sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args),
}));

const createVerificationToken = jest.fn();
jest.mock("@/server/auth/tokens", () => ({
  createVerificationToken: (...args: unknown[]) => createVerificationToken(...args),
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
  rateTesting.reset();
  allocateHandle.mockResolvedValue("asha");
  generateUniqueHandle.mockResolvedValue("asha");
  createVerificationToken.mockResolvedValue("rawtoken");
  sendVerificationEmail.mockResolvedValue(undefined);
});

describe("registerAction validation", () => {
  it("returns fieldErrors for a weak password", async () => {
    const result = await registerAction({
      email: "user@example.com",
      password: "short",
      displayName: "Asha",
    });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.password).toBeDefined();
  });

  it("returns fieldErrors for an invalid email", async () => {
    const result = await registerAction({
      email: "not-an-email",
      password: "Hunter22!",
      displayName: "Asha",
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
  it("creates a new user, issues a verification token, and sends an email", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "u1" });

    const result = await registerAction({
      email: "Asha@Example.com",
      password: "Hunter22!",
      displayName: "Asha",
      handle: "asha_p",
    });
    expect(result).toEqual({ ok: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]?.data?.email).toBe("asha@example.com");
    expect(create.mock.calls[0][0]?.data?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(createVerificationToken).toHaveBeenCalledWith({
      identifier: "asha@example.com",
      purpose: "EMAIL_VERIFICATION",
    });
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "asha@example.com", rawToken: "rawtoken" }),
    );
  });

  it("does not overwrite the password when the account already has one (and does not enumerate)", async () => {
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
    // Caller still sees ok: true — no enumeration channel.
    expect(result).toEqual({ ok: true });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("links a password to an OAuth-only account and sends verification when not yet verified", async () => {
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
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ passwordHash: expect.stringMatching(/^\$2[aby]\$12\$/) }),
    });
    expect(sendVerificationEmail).toHaveBeenCalled();
  });

  it("links a password to an already-verified OAuth account WITHOUT issuing a new verification email", async () => {
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
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("treats soft-deleted accounts as a no-op success", async () => {
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
    expect(result).toEqual({ ok: true });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("registerAction rate limit", () => {
  it("blocks after MAX_ATTEMPTS within the window", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "u1" });

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
