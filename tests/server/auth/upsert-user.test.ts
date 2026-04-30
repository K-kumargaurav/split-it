// Mock prisma at module load — upsertUser pulls @/lib/prisma at import time.

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

import { upsertUser } from "@/server/auth/upsert-user";

beforeEach(() => {
  jest.clearAllMocks();
  // Default: nothing in the DB — both email and handle lookups miss.
  findUnique.mockResolvedValue(null);
});

describe("upsertUser — verification semantics on create", () => {
  it("google sets emailVerifiedAt on first sign-in", async () => {
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u_g",
      email: data.email,
      handle: data.handle,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl ?? null,
      emailVerifiedAt: data.emailVerifiedAt ?? null,
      deletedAt: null,
    }));

    const u = await upsertUser({
      email: "asha@example.com",
      name: "Asha",
      provider: "google",
    });

    expect(u.emailVerifiedAt).toBeInstanceOf(Date);
    expect(create.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("magic-link sets emailVerifiedAt on create", async () => {
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u_m",
      email: data.email,
      handle: data.handle,
      displayName: data.displayName,
      avatarUrl: null,
      emailVerifiedAt: data.emailVerifiedAt,
      deletedAt: null,
    }));

    await upsertUser({
      email: "magic@example.com",
      provider: "magic-link",
    });
    expect(create.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("otp sets emailVerifiedAt on create", async () => {
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u_o",
      email: data.email,
      handle: data.handle,
      displayName: data.displayName,
      avatarUrl: null,
      emailVerifiedAt: data.emailVerifiedAt,
      deletedAt: null,
    }));

    await upsertUser({
      email: "otp@example.com",
      provider: "otp",
    });
    expect(create.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("credentials does NOT verify until the email step completes", async () => {
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u_c",
      email: data.email,
      handle: data.handle,
      displayName: data.displayName,
      avatarUrl: null,
      emailVerifiedAt: data.emailVerifiedAt,
      deletedAt: null,
    }));

    await upsertUser({
      email: "pwd@example.com",
      name: "Password User",
      provider: "credentials",
      handle: "pwduser",
      passwordHash: "$2b$12$abc",
    });

    expect(create.mock.calls[0][0].data.emailVerifiedAt).toBeNull();
    expect(create.mock.calls[0][0].data.passwordHash).toBe("$2b$12$abc");
    expect(create.mock.calls[0][0].data.handle).toBe("pwduser");
  });

  it("respects an explicit emailVerified=false override even on google", async () => {
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u_x",
      email: data.email,
      handle: data.handle,
      displayName: data.displayName,
      avatarUrl: null,
      emailVerifiedAt: data.emailVerifiedAt,
      deletedAt: null,
    }));

    await upsertUser({
      email: "x@example.com",
      provider: "google",
      emailVerified: false,
    });
    expect(create.mock.calls[0][0].data.emailVerifiedAt).toBeNull();
  });
});

describe("upsertUser — handle allocation", () => {
  it("auto-generates a handle from name when none supplied", async () => {
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u_h",
      email: data.email,
      handle: data.handle,
      displayName: data.displayName,
      avatarUrl: null,
      emailVerifiedAt: data.emailVerifiedAt,
      deletedAt: null,
    }));

    await upsertUser({
      email: "kumar@example.com",
      name: "Kumar Gaurav",
      provider: "google",
    });

    const handle = create.mock.calls[0][0].data.handle as string;
    expect(handle).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(handle.length).toBeGreaterThanOrEqual(3);
  });

  it("falls back to a unique suffix when the desired handle is taken", async () => {
    // 1st findUnique (email lookup) → null  → not existing
    // 2nd findUnique (isHandleFree on requested handle) → taken
    // 3rd findUnique (regenerated candidate from name) → taken
    // 4th findUnique (suffix candidate) → free
    findUnique
      .mockResolvedValueOnce(null) // email
      .mockResolvedValueOnce({ id: "other" }) // requested handle taken
      .mockResolvedValueOnce({ id: "other2" }) // regenerated candidate also taken
      .mockResolvedValue(null); // suffix candidates free
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u_h2",
      email: data.email,
      handle: data.handle,
      displayName: data.displayName,
      avatarUrl: null,
      emailVerifiedAt: data.emailVerifiedAt,
      deletedAt: null,
    }));

    await upsertUser({
      email: "asha@example.com",
      name: "Asha",
      provider: "credentials",
      handle: "asha",
    });

    const handle = create.mock.calls[0][0].data.handle as string;
    expect(handle).not.toBe("asha");
    expect(handle).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe("upsertUser — existing user", () => {
  it("backfills emailVerifiedAt when a verifying provider signs in", async () => {
    findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "asha@example.com",
      handle: "asha",
      displayName: "Asha",
      avatarUrl: null,
      emailVerifiedAt: null,
      deletedAt: null,
    });
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u1",
      email: "asha@example.com",
      handle: "asha",
      displayName: "Asha",
      avatarUrl: null,
      emailVerifiedAt: data.emailVerifiedAt ?? null,
      deletedAt: null,
    }));

    const u = await upsertUser({
      email: "asha@example.com",
      provider: "google",
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(u.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("never overwrites handle or passwordHash on an existing user", async () => {
    findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "asha@example.com",
      handle: "asha_original",
      displayName: "Asha",
      avatarUrl: null,
      emailVerifiedAt: new Date(),
      deletedAt: null,
    });

    await upsertUser({
      email: "asha@example.com",
      provider: "google",
      handle: "different_handle",
      passwordHash: "$2b$12$other",
    });

    // Already verified + nothing else missing → no update at all.
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("fills in displayName and avatar when the existing row is missing them", async () => {
    findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "asha@example.com",
      handle: "asha",
      displayName: "",
      avatarUrl: null,
      emailVerifiedAt: new Date(),
      deletedAt: null,
    });
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u1",
      email: "asha@example.com",
      handle: "asha",
      displayName: (data.displayName as string) ?? "",
      avatarUrl: (data.avatarUrl as string | null) ?? null,
      emailVerifiedAt: new Date(),
      deletedAt: null,
    }));

    await upsertUser({
      email: "asha@example.com",
      name: "Asha P.",
      image: "https://cdn/asha.png",
      provider: "google",
    });

    expect(update.mock.calls[0][0].data.displayName).toBe("Asha P.");
    expect(update.mock.calls[0][0].data.avatarUrl).toBe("https://cdn/asha.png");
  });
});

describe("upsertUser — input hardening", () => {
  it("normalizes email to lowercase before lookup and create", async () => {
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u_low",
      email: data.email,
      handle: data.handle,
      displayName: data.displayName,
      avatarUrl: null,
      emailVerifiedAt: data.emailVerifiedAt,
      deletedAt: null,
    }));

    await upsertUser({
      email: "  ASHA@Example.COM  ",
      provider: "google",
    });

    expect(findUnique.mock.calls[0][0].where.email).toBe("asha@example.com");
    expect(create.mock.calls[0][0].data.email).toBe("asha@example.com");
  });

  it("throws on empty email", async () => {
    await expect(
      upsertUser({ email: "   ", provider: "google" }),
    ).rejects.toThrow();
  });
});
