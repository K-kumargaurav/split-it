const groupCount = jest.fn();
const groupCreate = jest.fn();
const transaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    group: {
      count: (...args: unknown[]) => groupCount(...args),
      create: (...args: unknown[]) => groupCreate(...args),
    },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
  },
}));

import { AppError } from "@/lib/errors";
import { createGroup } from "@/server/groups/create-group";

const USER_ID = "u_owner";

// Reusable transaction stub: relays into the same mocked group methods so
// tests can assert on `groupCreate` regardless of whether the production
// code calls prisma.group.create directly or via the tx client.
function wireTransaction(): void {
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      group: {
        count: groupCount,
        create: groupCreate,
      },
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  wireTransaction();
});

describe("createGroup", () => {
  it("rejects invalid input as a VALIDATION_ERROR with field details", async () => {
    await expect(createGroup(USER_ID, { name: "" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 422,
    });
    expect(groupCount).not.toHaveBeenCalled();
    expect(groupCreate).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when the user already owns 10 active groups", async () => {
    groupCount.mockResolvedValueOnce(10);

    const promise = createGroup(USER_ID, { name: "Trip 11" });
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ code: "CONFLICT" });

    expect(transaction).not.toHaveBeenCalled();
    expect(groupCreate).not.toHaveBeenCalled();
  });

  it("creates the group with owner membership and 6 system categories", async () => {
    groupCount.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    groupCreate.mockResolvedValue({
      id: "g_1",
      name: "Goa",
      members: [
        {
          id: "gm_1",
          role: "OWNER",
          joinedAt: new Date(),
          user: { id: USER_ID, handle: "asha", displayName: "Asha", avatarUrl: null },
        },
      ],
    });

    const result = await createGroup(USER_ID, { name: "Goa" });

    expect(result.id).toBe("g_1");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(groupCreate).toHaveBeenCalledTimes(1);

    const args = groupCreate.mock.calls[0][0];
    expect(args.data.ownerId).toBe(USER_ID);
    expect(args.data.currency).toBe("INR");
    expect(args.data.balanceMode).toBe("DIRECT");
    expect(args.data.members.create).toEqual({ userId: USER_ID, role: "OWNER" });

    const categoryNames = args.data.categories.create.map(
      (c: { name: string }) => c.name,
    );
    expect(categoryNames).toEqual([
      "Food",
      "Travel",
      "Accommodation",
      "Utilities",
      "Entertainment",
      "Other",
    ]);
    for (const cat of args.data.categories.create) {
      expect(cat.isSystem).toBe(true);
    }
  });

  it("normalises currency to upper-case and accepts optional fields", async () => {
    groupCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    groupCreate.mockResolvedValue({ id: "g_2", members: [] });

    await createGroup(USER_ID, {
      name: "Roomies",
      description: "Apartment 4B",
      currency: "usd",
      color: "#10B981",
      icon: "🏠",
      balanceMode: "SIMPLIFIED",
    });

    const args = groupCreate.mock.calls[0][0];
    expect(args.data.currency).toBe("USD");
    expect(args.data.color).toBe("#10B981");
    expect(args.data.icon).toBe("🏠");
    expect(args.data.balanceMode).toBe("SIMPLIFIED");
    expect(args.data.description).toBe("Apartment 4B");
  });

  it("re-checks the cap inside the transaction to close concurrent-create races", async () => {
    // Pre-check passes (9 active), but by the time we're inside the tx the
    // cap has been hit (10 active) — still must reject without writing.
    groupCount.mockResolvedValueOnce(9).mockResolvedValueOnce(10);

    await expect(createGroup(USER_ID, { name: "Race" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(groupCreate).not.toHaveBeenCalled();
  });
});
