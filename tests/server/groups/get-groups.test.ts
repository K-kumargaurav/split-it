const memberFindMany = jest.fn();
const expenseFindMany = jest.fn();
const settlementGroupBy = jest.fn();
const groupFindFirst = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findMany: (...args: unknown[]) => memberFindMany(...args),
    },
    expense: {
      findMany: (...args: unknown[]) => expenseFindMany(...args),
    },
    settlement: {
      groupBy: (...args: unknown[]) => settlementGroupBy(...args),
    },
    group: {
      findFirst: (...args: unknown[]) => groupFindFirst(...args),
    },
  },
}));

import { AppError } from "@/lib/errors";
import { getGroupById, getGroupsForUser } from "@/server/groups/get-groups";

const USER_ID = "u_alice";

function settlementsBy(payerOrReceiver: "payer" | "receiver") {
  // The first groupBy() call inside the implementation queries settlements
  // OUT (where I'm payerId), the second IN (where I'm receiverId). We let
  // the test set up both arms via shared queue ordering.
  return settlementGroupBy.mock.calls.find((c) =>
    payerOrReceiver === "payer" ? c[0]?.where?.payerId : c[0]?.where?.receiverId,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Defaults — most tests overwrite these as needed.
  expenseFindMany.mockResolvedValue([]);
  settlementGroupBy.mockResolvedValue([]);
});

describe("getGroupsForUser", () => {
  it("returns an empty list when the user has no memberships", async () => {
    memberFindMany.mockResolvedValue([]);
    const groups = await getGroupsForUser(USER_ID);
    expect(groups).toEqual([]);
    expect(expenseFindMany).not.toHaveBeenCalled();
    expect(settlementGroupBy).not.toHaveBeenCalled();
  });

  it("returns groups with member count and net balance from expenses + settlements", async () => {
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

    // Alice paid 50000 paise total, owes 30000 paise → +20000.
    expenseFindMany.mockResolvedValue([
      {
        groupId: "g_1",
        payers: [{ amountPaise: BigInt(50000) }],
        participants: [{ amountPaise: BigInt(30000) }],
      },
    ]);
    // Settled out 10000 paise → balance becomes +10000 net.
    settlementGroupBy
      .mockResolvedValueOnce([{ groupId: "g_1", _sum: { amountPaise: BigInt(10000) } }])
      .mockResolvedValueOnce([]);

    const groups = await getGroupsForUser(USER_ID);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: "g_1",
      name: "Goa",
      memberCount: 4,
      role: "OWNER",
      balancePaise: 10_000,
      currency: "INR",
      balanceMode: "DIRECT",
    });

    expect(settlementsBy("payer")).toBeDefined();
    expect(settlementsBy("receiver")).toBeDefined();
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
      ],
      _count: { expenses: 3 },
    });
    expenseFindMany.mockResolvedValue([
      {
        groupId: "g_1",
        payers: [],
        participants: [{ amountPaise: BigInt(2500) }],
      },
    ]);
    settlementGroupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await getGroupById(USER_ID, "g_1");

    expect(result.viewerRole).toBe("MEMBER");
    expect(result.balancePaise).toBe(-2500);
    expect(result._count.expenses).toBe(3);
  });
});
