// Mocks for propose-edit. Hoisted via jest.mock() before the SUT import.

const groupMemberFindUnique = jest.fn();
const groupMemberFindMany = jest.fn();
const expenseFindUnique = jest.fn();
const expenseUpdate = jest.fn();
const expenseProposalFindFirst = jest.fn();
const expenseProposalCreate = jest.fn();
const expensePayerFindMany = jest.fn();
const auditLogCreate = jest.fn();
const notificationCreate = jest.fn();
const notificationPrefFindMany = jest.fn();
const transaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findUnique: (...a: unknown[]) => groupMemberFindUnique(...a),
      findMany: (...a: unknown[]) => groupMemberFindMany(...a),
    },
    expense: {
      findUnique: (...a: unknown[]) => expenseFindUnique(...a),
    },
    expenseProposal: {
      findFirst: (...a: unknown[]) => expenseProposalFindFirst(...a),
    },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
  },
}));

import { AppError } from "@/lib/errors";
import { proposeExpenseEdit } from "@/server/expenses/propose-edit";

const ACTOR = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const GROUP = "00000000-0000-4000-8000-000000000099";
const EXPENSE = "00000000-0000-4000-8000-0000000000ee";

function wireTx(): void {
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      expense: { findUnique: expenseFindUnique, update: expenseUpdate },
      expensePayer: { findMany: expensePayerFindMany },
      expenseProposal: {
        create: expenseProposalCreate,
        findFirst: expenseProposalFindFirst,
      },
      auditLog: { create: auditLogCreate },
      groupMember: { findMany: groupMemberFindMany },
      notification: { create: notificationCreate },
      notificationPref: { findMany: notificationPrefFindMany },
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  wireTx();
  groupMemberFindUnique.mockResolvedValue({ id: "gm_self" });
  groupMemberFindMany.mockResolvedValue([
    { userId: ACTOR },
    { userId: OTHER },
    { userId: "u3" },
    { userId: "u4" },
  ]);
  notificationPrefFindMany.mockResolvedValue([]);
  notificationCreate.mockResolvedValue({ id: "notif_1" });
});

describe("proposeExpenseEdit — own expense applies immediately", () => {
  it("applies the patch directly and writes an UPDATED audit log; no proposal created", async () => {
    expenseFindUnique.mockResolvedValueOnce({
      id: EXPENSE,
      groupId: GROUP,
      title: "Coffee",
      createdBy: ACTOR,
      status: "ACTIVE",
    });
    // applyExpensePatch's lookup
    expenseFindUnique.mockResolvedValueOnce({
      id: EXPENSE,
      title: "Coffee",
      totalAmount: BigInt(900),
      date: new Date("2026-04-01"),
      notes: null,
      splitType: "EQUAL",
      participants: [{ userId: "u3", amountPaise: BigInt(900) }],
    });

    const result = await proposeExpenseEdit(ACTOR, GROUP, EXPENSE, {
      title: "Coffee (large)",
    });

    expect(result.applied).toBe(true);
    expect(result.proposal).toBeUndefined();
    expect(expenseUpdate).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
    expect(auditLogCreate.mock.calls[0][0].data.action).toBe("UPDATED");
    expect(expenseProposalCreate).not.toHaveBeenCalled();
  });
});

describe("proposeExpenseEdit — other member opens a proposal", () => {
  it("creates a PENDING proposal with 48h expiry; expense is not mutated", async () => {
    expenseFindUnique.mockResolvedValueOnce({
      id: EXPENSE,
      groupId: GROUP,
      title: "Lunch",
      createdBy: OTHER,
      status: "ACTIVE",
    });
    expenseProposalFindFirst.mockResolvedValue(null);
    expenseProposalCreate.mockResolvedValue({
      id: "p_1",
      expenseId: EXPENSE,
      proposedBy: ACTOR,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 48 * 3600_000),
    });

    const before = Date.now();
    const result = await proposeExpenseEdit(ACTOR, GROUP, EXPENSE, {
      title: "Lunch v2",
    });

    expect(result.applied).toBe(false);
    expect(result.proposal?.id).toBe("p_1");
    const expiry = result.proposal!.expiresAt.getTime();
    expect(expiry).toBeGreaterThan(before + 47 * 3600_000);
    expect(expiry).toBeLessThanOrEqual(Date.now() + 48 * 3600_000 + 1000);
    expect(expenseUpdate).not.toHaveBeenCalled();
    expect(expenseProposalCreate).toHaveBeenCalledTimes(1);
  });

  it("rejects with 409 when an active proposal already exists", async () => {
    expenseFindUnique.mockResolvedValueOnce({
      id: EXPENSE,
      groupId: GROUP,
      title: "Lunch",
      createdBy: OTHER,
      status: "ACTIVE",
    });
    expenseProposalFindFirst.mockResolvedValue({ id: "p_existing" });

    await expect(
      proposeExpenseEdit(ACTOR, GROUP, EXPENSE, { title: "Lunch v2" }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
    expect(expenseProposalCreate).not.toHaveBeenCalled();
  });
});

describe("proposeExpenseEdit — guards", () => {
  it("rejects non-members with FORBIDDEN", async () => {
    groupMemberFindUnique.mockResolvedValue(null);

    await expect(
      proposeExpenseEdit(ACTOR, GROUP, EXPENSE, { title: "x" }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects with NOT_FOUND when expense belongs to a different group", async () => {
    expenseFindUnique.mockResolvedValueOnce({
      id: EXPENSE,
      groupId: "other-group",
      title: "Lunch",
      createdBy: OTHER,
      status: "ACTIVE",
    });
    await expect(
      proposeExpenseEdit(ACTOR, GROUP, EXPENSE, { title: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects empty patch as VALIDATION_ERROR", async () => {
    await expect(
      proposeExpenseEdit(ACTOR, GROUP, EXPENSE, {}),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
