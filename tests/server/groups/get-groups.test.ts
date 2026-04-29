// Both `getGroupsForUser` and `getGroupById` now route their per-group
// balance through `getUserNetBalance` so the dashboard, the group list, and
// the group page all read from a single canonical algorithm. Mocks below
// reflect that internal call shape: full ledger reads (not the per-user
// aggregate that the old buggy implementation used).

const memberFindMany = jest.fn();
const memberFindUnique = jest.fn();
const expenseFindMany = jest.fn();
const settlementFindMany = jest.fn();
const groupFindFirst = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findMany: (...args: unknown[]) => memberFindMany(...args),
      findUnique: (...args: unknown[]) => memberFindUnique(...args),
    },
    expense: {
      findMany: (...args: unknown[]) => expenseFindMany(...args),
    },
    settlement: {
      findMany: (...args: unknown[]) => settlementFindMany(...args),
    },
    group: {
      findFirst: (...args: unknown[]) => groupFindFirst(...args),
    },
  },
}));

import { AppError } from "@/lib/errors";
import { getGroupById, getGroupsForUser } from "@/server/groups/get-groups";

const USER_ID = "u_alice";
const BOB = "u_bob";

beforeEach(() => {
  jest.clearAllMocks();
  // Membership gate inside `getUserNetBalance` — the SUT only invokes this
  // for groups the caller already proved access to, so a stub success row
  // matches reality.
  memberFindUnique.mockResolvedValue({ id: "gm_self" });
  expenseFindMany.mockResolvedValue([]);
  settlementFindMany.mockResolvedValue([]);
});

describe("getGroupsForUser", () => {
  it("returns an empty list when the user has no memberships", async () => {
    memberFindMany.mockResolvedValue([]);
    const groups = await getGroupsForUser(USER_ID);
    expect(groups).toEqual([]);
    expect(expenseFindMany).not.toHaveBeenCalled();
    expect(settlementFindMany).not.toHaveBeenCalled();
  });

  it("returns groups with member count and net balance from the direct ledger", async () => {
    const updatedAt = new Date("2026-04-20T10:00:00Z");
    memberFindMany.mockResolvedValue([
      {
        role: "OWNER",
        group: {
          id: "g_1",
          name: "Goa",
          description: null,
          color: "#6366F1",
          icon: null,
          currency: "INR",
          balanceMode: "DIRECT",
          status: "ACTIVE",
          updatedAt,
          _count: { members: 4 },
        },
      },
    ]);

    // Alice paid 50000 paise for an expense split equally with Bob (25000
    // each). Direct-ledger net for Alice from this expense alone is +25000.
    expenseFindMany.mockResolvedValue([
      {
        payers: [{ userId: USER_ID, amountPaise: BigInt(50000) }],
        participants: [
          { userId: USER_ID, amountPaise: BigInt(25000) },
          { userId: BOB, amountPaise: BigInt(25000) },
        ],
      },
    ]);
    // Bob settles 10000 to Alice (Bob is settlement-payer, Alice is
    // receiver). Settlement reduces Alice's outstanding credit, so the
    // canonical net drops from +25000 to +15000.
    settlementFindMany.mockResolvedValue([
      { payerId: BOB, receiverId: USER_ID, amountPaise: BigInt(10000) },
    ]);

    const groups = await getGroupsForUser(USER_ID);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: "g_1",
      name: "Goa",
      memberCount: 4,
      role: "OWNER",
      balancePaise: 15_000,
      currency: "INR",
      balanceMode: "DIRECT",
    });
  });

  it("sorts groups by most-recent updatedAt", async () => {
    memberFindMany.mockResolvedValue([
      {
        role: "MEMBER",
        group: {
          id: "g_old",
          name: "Old",
          description: null,
          color: null,
          icon: null,
          currency: "INR",
          balanceMode: "DIRECT",
          status: "ACTIVE",
          updatedAt: new Date("2026-01-01T00:00:00Z"),
          _count: { members: 2 },
        },
      },
      {
        role: "OWNER",
        group: {
          id: "g_new",
          name: "New",
          description: null,
          color: null,
          icon: null,
          currency: "INR",
          balanceMode: "DIRECT",
          status: "ACTIVE",
          updatedAt: new Date("2026-04-20T00:00:00Z"),
          _count: { members: 3 },
        },
      },
    ]);

    const groups = await getGroupsForUser(USER_ID);
    expect(groups.map((g) => g.id)).toEqual(["g_new", "g_old"]);
  });
});

describe("getGroupById", () => {
  it("throws NOT_FOUND when no group row matches", async () => {
    groupFindFirst.mockResolvedValue(null);

    const promise = getGroupById(USER_ID, "g_missing");
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN when the user is not in the group's member list", async () => {
    groupFindFirst.mockResolvedValue({
      id: "g_secret",
      members: [
        {
          id: "gm_x",
          role: "OWNER",
          joinedAt: new Date(),
          user: { id: "someone-else", handle: "x", displayName: "X", avatarUrl: null },
        },
      ],
      _count: { expenses: 0 },
    });

    await expect(getGroupById(USER_ID, "g_secret")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns the group with viewer role + balance when the user is a member", async () => {
    groupFindFirst.mockResolvedValue({
      id: "g_1",
      name: "Goa",
      members: [
        {
          id: "gm_1",
          role: "MEMBER",
          joinedAt: new Date(),
          user: { id: USER_ID, handle: "alice", displayName: "Alice", avatarUrl: null },
        },
        {
          id: "gm_2",
          role: "OWNER",
          joinedAt: new Date(),
          user: { id: BOB, handle: "bob", displayName: "Bob", avatarUrl: null },
        },
      ],
      _count: { expenses: 3 },
    });
    // Bob covered an expense; Alice's share is 2500. Direct ledger says
    // Alice owes Bob 2500 → viewer's net is -2500.
    expenseFindMany.mockResolvedValue([
      {
        payers: [{ userId: BOB, amountPaise: BigInt(2500) }],
        participants: [{ userId: USER_ID, amountPaise: BigInt(2500) }],
      },
    ]);

    const result = await getGroupById(USER_ID, "g_1");

    expect(result.viewerRole).toBe("MEMBER");
    expect(result.balancePaise).toBe(-2500);
    expect(result._count.expenses).toBe(3);
  });
});
