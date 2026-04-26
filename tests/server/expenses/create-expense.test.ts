// Mocks must be hoisted via jest.mock() before importing the SUT, since the
// SUT pulls in Prisma at module load. We keep the mock targets minimal —
// only the methods createExpense actually calls.

const groupMemberFindUnique = jest.fn();
const groupMemberFindMany = jest.fn();
const expenseCreate = jest.fn();
const auditLogCreate = jest.fn();
const transaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findUnique: (...args: unknown[]) => groupMemberFindUnique(...args),
      findMany: (...args: unknown[]) => groupMemberFindMany(...args),
    },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
  },
}));

import { AppError } from "@/lib/errors";
import { equalSplit } from "@/lib/split";
import { createExpense } from "@/server/expenses/create-expense";

const ACTOR = "00000000-0000-4000-8000-000000000001";
const GROUP = "00000000-0000-4000-8000-000000000099";
const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const CAROL = "00000000-0000-4000-8000-00000000000c";

function wireTransaction(): void {
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      expense: { create: expenseCreate },
      auditLog: { create: auditLogCreate },
    }),
  );
}

function defaultMembership(): void {
  groupMemberFindUnique.mockResolvedValue({ id: "gm_self" });
  groupMemberFindMany.mockResolvedValue(
    [ACTOR, ALICE, BOB, CAROL].map((userId) => ({ userId })),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  wireTransaction();
});

describe("createExpense — equal-split rounding", () => {
  it.each([
    { total: 100, ids: [ALICE, BOB, CAROL], expected: [BigInt(34), BigInt(33), BigInt(33)] },
    { total: 10, ids: [ALICE, BOB, CAROL], expected: [BigInt(4), BigInt(3), BigInt(3)] },
    { total: 99, ids: [ALICE, BOB], expected: [BigInt(50), BigInt(49)] },
  ])(
    "$total paise / $ids.length people → $expected",
    async ({ total, ids, expected }) => {
      defaultMembership();
      expenseCreate.mockResolvedValue({
        id: "exp_1",
        title: "T",
        totalAmount: BigInt(total),
        splitType: "EQUAL",
        date: new Date(),
        createdAt: new Date(),
        payers: [],
        participants: [],
      });

      await createExpense(ACTOR, GROUP, {
        title: "T",
        date: "2026-04-26",
        totalAmount: total,
        splitType: "EQUAL",
        payerSplits: [{ userId: ACTOR, amountPaise: total }],
        participantIds: ids,
      });

      const created = expenseCreate.mock.calls[0][0];
      const shares = created.data.participants.create.map(
        (p: { amountPaise: bigint }) => p.amountPaise,
      );
      expect(shares).toEqual(expected);

      // Cross-check: the same shares the pure function produces, in the
      // same order. Guards against the SUT silently re-ordering participants.
      const pure = equalSplit(total, ids.length).map((n) => BigInt(n));
      expect(shares).toEqual(pure);
    },
  );

  it("writes baseAmount and totalAmount as BigInt(total)", async () => {
    defaultMembership();
    expenseCreate.mockResolvedValue({
      id: "exp_2",
      title: "T",
      totalAmount: BigInt(600),
      splitType: "EQUAL",
      date: new Date(),
      createdAt: new Date(),
      payers: [],
      participants: [],
    });

    await createExpense(ACTOR, GROUP, {
      title: "Cab",
      date: "2026-04-26",
      totalAmount: 600,
      splitType: "EQUAL",
      payerSplits: [{ userId: ACTOR, amountPaise: 600 }],
      participantIds: [ALICE, BOB, CAROL],
    });

    const data = expenseCreate.mock.calls[0][0].data;
    expect(data.baseAmount).toBe(BigInt(600));
    expect(data.totalAmount).toBe(BigInt(600));
    expect(data.splitType).toBe("EQUAL");
  });

  it("creates an EXPENSE/CREATED audit log row in the same transaction", async () => {
    defaultMembership();
    expenseCreate.mockResolvedValue({
      id: "exp_audit",
      title: "Pizza",
      totalAmount: BigInt(900),
      splitType: "EQUAL",
      date: new Date(),
      createdAt: new Date(),
      payers: [],
      participants: [],
    });

    await createExpense(ACTOR, GROUP, {
      title: "Pizza",
      date: "2026-04-26",
      totalAmount: 900,
      splitType: "EQUAL",
      payerSplits: [{ userId: ACTOR, amountPaise: 900 }],
      participantIds: [ALICE, BOB, CAROL],
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
    const logArgs = auditLogCreate.mock.calls[0][0];
    expect(logArgs.data.entityType).toBe("EXPENSE");
    expect(logArgs.data.action).toBe("CREATED");
    expect(logArgs.data.entityId).toBe("exp_audit");
    expect(logArgs.data.actorId).toBe(ACTOR);
    expect(logArgs.data.groupId).toBe(GROUP);
  });
});

describe("createExpense — guards", () => {
  it("rejects non-members with FORBIDDEN", async () => {
    groupMemberFindUnique.mockResolvedValue(null);

    await expect(
      createExpense(ACTOR, GROUP, {
        title: "T",
        date: "2026-04-26",
        totalAmount: 100,
        splitType: "EQUAL",
        payerSplits: [{ userId: ACTOR, amountPaise: 100 }],
        participantIds: [ALICE],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects when payerSplits do not sum to totalAmount (422)", async () => {
    defaultMembership();

    await expect(
      createExpense(ACTOR, GROUP, {
        title: "T",
        date: "2026-04-26",
        totalAmount: 100,
        splitType: "EQUAL",
        payerSplits: [{ userId: ACTOR, amountPaise: 50 }],
        participantIds: [ALICE, BOB],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects when a participant is not a group member (422)", async () => {
    groupMemberFindUnique.mockResolvedValue({ id: "gm_self" });
    groupMemberFindMany.mockResolvedValue(
      [ACTOR, ALICE].map((userId) => ({ userId })),
    );

    await expect(
      createExpense(ACTOR, GROUP, {
        title: "T",
        date: "2026-04-26",
        totalAmount: 100,
        splitType: "EQUAL",
        payerSplits: [{ userId: ACTOR, amountPaise: 100 }],
        participantIds: [ALICE, BOB],
      }),
    ).rejects.toBeInstanceOf(AppError);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed input as VALIDATION_ERROR (422)", async () => {
    await expect(
      createExpense(ACTOR, GROUP, {
        title: "",
        date: "not-a-date",
        totalAmount: 0,
        splitType: "EQUAL",
        payerSplits: [],
        participantIds: [],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });

    expect(groupMemberFindUnique).not.toHaveBeenCalled();
  });
});
