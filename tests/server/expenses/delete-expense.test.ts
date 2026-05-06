// Tests for delete-expense: own-author soft-deletes immediately; non-author
// opens a deletion proposal; duplicate proposal returns 409.

const groupMemberFindUnique = jest.fn();
const groupMemberFindMany = jest.fn();
const expenseFindUnique = jest.fn();
const expenseUpdate = jest.fn();
const proposalFindFirst = jest.fn();
const proposalCreate = jest.fn();
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
    expense: { findUnique: (...a: unknown[]) => expenseFindUnique(...a) },
    expenseProposal: {
      findFirst: (...a: unknown[]) => proposalFindFirst(...a),
    },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
  },
}));

import { deleteExpense } from "@/server/expenses/delete-expense";

const ACTOR = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const GROUP = "00000000-0000-4000-8000-000000000099";
const EXPENSE = "00000000-0000-4000-8000-0000000000ee";

beforeEach(() => {
  jest.clearAllMocks();
  groupMemberFindUnique.mockResolvedValue({ id: "gm_self" });
  groupMemberFindMany.mockResolvedValue([
    { userId: ACTOR },
    { userId: OTHER },
  ]);
  notificationPrefFindMany.mockResolvedValue([]);
  notificationCreate.mockResolvedValue({ id: "notif_1" });
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      expense: { update: expenseUpdate },
      expenseProposal: { create: proposalCreate, findFirst: proposalFindFirst },
      auditLog: { create: auditLogCreate },
      groupMember: { findMany: groupMemberFindMany },
      notification: { create: notificationCreate },
      notificationPref: { findMany: notificationPrefFindMany },
    }),
  );
});

describe("deleteExpense — self-author soft-deletes immediately", () => {
  it("sets status=DELETED and writes a DELETED audit log; no proposal created", async () => {
    expenseFindUnique.mockResolvedValueOnce({
      id: EXPENSE,
      groupId: GROUP,
      title: "Coffee",
      status: "ACTIVE",
      createdBy: ACTOR,
    });

    const result = await deleteExpense(ACTOR, GROUP, EXPENSE);

    expect(result.applied).toBe(true);
    expect(expenseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EXPENSE },
        data: expect.objectContaining({ status: "DELETED" }),
      }),
    );
    expect(auditLogCreate.mock.calls[0][0].data.action).toBe("DELETED");
    expect(proposalCreate).not.toHaveBeenCalled();
  });
});

describe("deleteExpense — others' expense opens a DELETE proposal", () => {
  it("creates a DELETE-kind proposal; expense is not mutated", async () => {
    expenseFindUnique.mockResolvedValueOnce({
      id: EXPENSE,
      groupId: GROUP,
      title: "Lunch",
      status: "ACTIVE",
      createdBy: OTHER,
    });
    proposalFindFirst.mockResolvedValue(null);
    proposalCreate.mockResolvedValue({
      id: "p_del_1",
      expiresAt: new Date(Date.now() + 48 * 3600_000),
    });

    const result = await deleteExpense(ACTOR, GROUP, EXPENSE);

    expect(result.applied).toBe(false);
    expect(result.proposal?.id).toBe("p_del_1");
    expect(proposalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          proposedChanges: { kind: "DELETE" },
          status: "PENDING",
        }),
      }),
    );
    expect(expenseUpdate).not.toHaveBeenCalled();
  });

  it("rejects with 409 when an active proposal already exists", async () => {
    expenseFindUnique.mockResolvedValueOnce({
      id: EXPENSE,
      groupId: GROUP,
      title: "Lunch",
      status: "ACTIVE",
      createdBy: OTHER,
    });
    proposalFindFirst.mockResolvedValue({ id: "p_existing" });

    await expect(deleteExpense(ACTOR, GROUP, EXPENSE)).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
    expect(proposalCreate).not.toHaveBeenCalled();
  });
});
