// Mocks must be hoisted via jest.mock() before importing the SUT, since the
// SUT pulls in Prisma at module load. We mock the small surface that
// searchExpenses actually touches: membership lookup, the FTS raw query, and
// the main findMany — and assert against the where-clause Prisma receives
// rather than against rows of fixture data.

const groupMemberFindUnique = jest.fn();
const expenseFindMany = jest.fn();
const queryRaw = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findUnique: (...args: unknown[]) => groupMemberFindUnique(...args),
    },
    expense: {
      findMany: (...args: unknown[]) => expenseFindMany(...args),
    },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { AppError } from "@/lib/errors";
import { searchExpenses } from "@/server/expenses/search-expenses";

const VIEWER = "00000000-0000-4000-8000-000000000001";
const GROUP = "00000000-0000-4000-8000-000000000099";
const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

function membershipOk(): void {
  groupMemberFindUnique.mockResolvedValue({ id: "gm_self" });
}

interface ExpenseFixture {
  id: string;
  title: string;
  notes: string | null;
  totalAmount: bigint;
  date: Date;
  createdAt: Date;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE";
  category: { id: string; name: string; emoji: string | null; color: string | null } | null;
  payers: Array<{ userId: string; amountPaise: bigint; user: { id: string; displayName: string } }>;
  participants: Array<{ userId: string; amountPaise: bigint; user: { id: string; displayName: string } }>;
}

function expense(overrides: Partial<ExpenseFixture> = {}): ExpenseFixture {
  const id = overrides.id ?? "exp_1";
  return {
    id,
    title: overrides.title ?? "Lunch",
    notes: overrides.notes ?? null,
    totalAmount: overrides.totalAmount ?? BigInt(20000),
    date: overrides.date ?? new Date("2026-04-15"),
    createdAt: overrides.createdAt ?? new Date("2026-04-15T10:00:00Z"),
    splitType: overrides.splitType ?? "EQUAL",
    category: overrides.category ?? null,
    payers: overrides.payers ?? [
      {
        userId: VIEWER,
        amountPaise: BigInt(20000),
        user: { id: VIEWER, displayName: "You" },
      },
    ],
    participants: overrides.participants ?? [
      {
        userId: VIEWER,
        amountPaise: BigInt(10000),
        user: { id: VIEWER, displayName: "You" },
      },
      {
        userId: ALICE,
        amountPaise: BigInt(10000),
        user: { id: ALICE, displayName: "Alice" },
      },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("searchExpenses — auth", () => {
  it("rejects non-members with FORBIDDEN", async () => {
    groupMemberFindUnique.mockResolvedValue(null);
    await expect(
      searchExpenses(VIEWER, GROUP, {}),
    ).rejects.toBeInstanceOf(AppError);
    expect(expenseFindMany).not.toHaveBeenCalled();
  });
});

describe("searchExpenses — keyword", () => {
  it("runs the FTS raw query and constrains findMany to matching ids", async () => {
    membershipOk();
    queryRaw.mockResolvedValue([{ id: "exp_a" }, { id: "exp_b" }]);
    expenseFindMany.mockResolvedValue([
      expense({ id: "exp_a", title: "Groceries" }),
      expense({ id: "exp_b", title: "Groceries refill" }),
    ]);

    const page = await searchExpenses(VIEWER, GROUP, { keyword: "groceries" });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ in: ["exp_a", "exp_b"] });
    expect(page.items.map((i) => i.id)).toEqual(["exp_a", "exp_b"]);
  });

  it("short-circuits to an empty page when FTS returns no matches", async () => {
    membershipOk();
    queryRaw.mockResolvedValue([]);

    const page = await searchExpenses(VIEWER, GROUP, { keyword: "nothing" });

    expect(expenseFindMany).not.toHaveBeenCalled();
    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it("ignores blank keywords (whitespace only)", async () => {
    membershipOk();
    expenseFindMany.mockResolvedValue([]);

    await searchExpenses(VIEWER, GROUP, { keyword: "   " });

    expect(queryRaw).not.toHaveBeenCalled();
    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where.id).toBeUndefined();
  });
});

describe("searchExpenses — date range", () => {
  it("applies dateFrom and dateTo as gte/lte on the date column", async () => {
    membershipOk();
    expenseFindMany.mockResolvedValue([]);
    const from = new Date("2026-03-01");
    const to = new Date("2026-03-31");

    await searchExpenses(VIEWER, GROUP, { dateFrom: from, dateTo: to });

    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where.date).toEqual({ gte: from, lte: to });
  });

  it("applies only dateFrom when dateTo is absent", async () => {
    membershipOk();
    expenseFindMany.mockResolvedValue([]);
    const from = new Date("2026-04-01");

    await searchExpenses(VIEWER, GROUP, { dateFrom: from });

    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where.date).toEqual({ gte: from });
  });
});

describe("searchExpenses — paidBy", () => {
  it("constrains to expenses with at least one matching payer", async () => {
    membershipOk();
    expenseFindMany.mockResolvedValue([]);

    await searchExpenses(VIEWER, GROUP, { paidBy: ALICE });

    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where.payers).toEqual({ some: { userId: ALICE } });
  });
});

describe("searchExpenses — involves", () => {
  it("constrains to expenses that include the user as a participant", async () => {
    membershipOk();
    expenseFindMany.mockResolvedValue([]);

    await searchExpenses(VIEWER, GROUP, { involves: BOB });

    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where.participants).toEqual({ some: { userId: BOB } });
  });
});

describe("searchExpenses — amount range", () => {
  it("applies minAmount and maxAmount as gte/lte on totalAmount", async () => {
    membershipOk();
    expenseFindMany.mockResolvedValue([]);

    await searchExpenses(VIEWER, GROUP, {
      minAmount: BigInt(10000),
      maxAmount: BigInt(50000),
    });

    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where.totalAmount).toEqual({
      gte: BigInt(10000),
      lte: BigInt(50000),
    });
  });

  it("applies only minAmount when maxAmount is absent", async () => {
    membershipOk();
    expenseFindMany.mockResolvedValue([]);

    await searchExpenses(VIEWER, GROUP, { minAmount: BigInt(2500) });

    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where.totalAmount).toEqual({ gte: BigInt(2500) });
  });
});

describe("searchExpenses — combined filters", () => {
  it("AND-composes every filter into the same where clause", async () => {
    membershipOk();
    queryRaw.mockResolvedValue([{ id: "exp_x" }]);
    expenseFindMany.mockResolvedValue([
      expense({ id: "exp_x", title: "Trip dinner", notes: "with team" }),
    ]);

    const from = new Date("2026-04-01");
    const to = new Date("2026-04-30");

    await searchExpenses(VIEWER, GROUP, {
      dateFrom: from,
      dateTo: to,
      categoryId: "cat-1",
      paidBy: ALICE,
      involves: BOB,
      minAmount: BigInt(5000),
      maxAmount: BigInt(100000),
      keyword: "dinner",
    });

    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      groupId: GROUP,
      status: "ACTIVE",
      deletedAt: null,
      date: { gte: from, lte: to },
      categoryId: "cat-1",
      payers: { some: { userId: ALICE } },
      participants: { some: { userId: BOB } },
      totalAmount: { gte: BigInt(5000), lte: BigInt(100000) },
      id: { in: ["exp_x"] },
    });
  });
});

describe("searchExpenses — pagination", () => {
  it("orders by (date DESC, createdAt DESC, id DESC) and returns nextCursor when over limit", async () => {
    membershipOk();
    // Return take+1 rows so nextCursor must be set.
    expenseFindMany.mockResolvedValue([
      expense({ id: "exp_1" }),
      expense({ id: "exp_2" }),
      expense({ id: "exp_3" }),
    ]);

    const page = await searchExpenses(VIEWER, GROUP, {}, undefined, 2);

    const args = expenseFindMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([
      { date: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(args.take).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe("exp_2");
  });

  it("returns null nextCursor on the last page", async () => {
    membershipOk();
    expenseFindMany.mockResolvedValue([expense({ id: "exp_only" })]);

    const page = await searchExpenses(VIEWER, GROUP, {}, undefined, 25);

    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(1);
  });

  it("forwards the cursor with skip:1 when one is supplied", async () => {
    membershipOk();
    expenseFindMany.mockResolvedValue([]);

    await searchExpenses(VIEWER, GROUP, {}, "exp_after", 25);

    const args = expenseFindMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: "exp_after" });
    expect(args.skip).toBe(1);
  });
});

describe("searchExpenses — output mapping", () => {
  it("computes yourSharePaise and yourPaidPaise from the viewer's rows", async () => {
    membershipOk();
    expenseFindMany.mockResolvedValue([
      expense({
        id: "exp_y",
        payers: [
          {
            userId: VIEWER,
            amountPaise: BigInt(15000),
            user: { id: VIEWER, displayName: "You" },
          },
        ],
        participants: [
          {
            userId: VIEWER,
            amountPaise: BigInt(7500),
            user: { id: VIEWER, displayName: "You" },
          },
          {
            userId: ALICE,
            amountPaise: BigInt(7500),
            user: { id: ALICE, displayName: "Alice" },
          },
        ],
      }),
    ]);

    const page = await searchExpenses(VIEWER, GROUP, {});

    expect(page.items[0]!.yourPaidPaise).toBe(15000);
    expect(page.items[0]!.yourSharePaise).toBe(7500);
  });
});
