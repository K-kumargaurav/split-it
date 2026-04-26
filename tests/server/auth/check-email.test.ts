const findUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

import { checkEmailExists } from "@/server/auth/check-email";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("checkEmailExists", () => {
  it("returns exists:false for a malformed email and skips the DB", async () => {
    const result = await checkEmailExists("not-an-email");
    expect(result).toEqual({ exists: false });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns exists:true when an active account matches", async () => {
    findUnique.mockResolvedValue({ id: "u_1", deletedAt: null });
    const result = await checkEmailExists("asha@example.com");
    expect(result).toEqual({ exists: true });
  });

  it("returns exists:false for soft-deleted accounts so the address can be reclaimed", async () => {
    findUnique.mockResolvedValue({ id: "u_1", deletedAt: new Date() });
    const result = await checkEmailExists("asha@example.com");
    expect(result).toEqual({ exists: false });
  });

  it("returns exists:false when no user exists", async () => {
    findUnique.mockResolvedValue(null);
    const result = await checkEmailExists("new@example.com");
    expect(result).toEqual({ exists: false });
  });

  it("normalises trim + case before lookup (matches emailSchema)", async () => {
    findUnique.mockResolvedValue(null);
    await checkEmailExists("  ASHA@Example.COM ");
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "asha@example.com" },
      select: { id: true, deletedAt: true },
    });
  });
});
