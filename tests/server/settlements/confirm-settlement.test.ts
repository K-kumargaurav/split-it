const settlementFindUnique = jest.fn();
const settlementUpdate = jest.fn();
const auditLogCreate = jest.fn();
const notificationCreate = jest.fn();
const transaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    settlement: {
      findUnique: (...args: unknown[]) => settlementFindUnique(...args),
    },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
  },
}));

import {
  confirmSettlement,
  disputeSettlement,
} from "@/server/settlements/confirm-settlement";

const PAYER = "00000000-0000-4000-8000-00000000000a";
const RECEIVER = "00000000-0000-4000-8000-00000000000b";
const OUTSIDER = "00000000-0000-4000-8000-00000000000c";
const GROUP = "00000000-0000-4000-8000-000000000099";
const SETTLEMENT_ID = "00000000-0000-4000-8000-0000000000ff";

const p = (n: number): bigint => BigInt(n);

function wireTransaction(): void {
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      settlement: { update: settlementUpdate },
      auditLog: { create: auditLogCreate },
      notification: { create: notificationCreate },
    }),
  );
}

function pendingSettlement(): unknown {
  return {
    id: SETTLEMENT_ID,
    groupId: GROUP,
    payerId: PAYER,
    receiverId: RECEIVER,
    amountPaise: p(10000),
    paymentMethod: "UPI",
    paymentRef: null,
    status: "PENDING_CONFIRMATION",
    createdAt: new Date(),
    confirmedAt: null,
    deletedAt: null,
    payer: { id: PAYER, handle: "alice", displayName: "Alice" },
    receiver: { id: RECEIVER, handle: "bob", displayName: "Bob" },
  };
}

function defaultUpdateResult(status: "CONFIRMED" | "DISPUTED"): void {
  settlementUpdate.mockResolvedValue({
    ...(pendingSettlement() as Record<string, unknown>),
    status,
    confirmedAt: status === "CONFIRMED" ? new Date() : null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  wireTransaction();
});

describe("confirmSettlement", () => {
  it("CONFIRMS a pending settlement when called by the receiver", async () => {
    settlementFindUnique.mockResolvedValueOnce(pendingSettlement());
    defaultUpdateResult("CONFIRMED");

    const result = await confirmSettlement(RECEIVER, SETTLEMENT_ID);
    expect(result.status).toBe("CONFIRMED");

    // Update writes status + confirmedAt timestamp.
    const updateArgs = settlementUpdate.mock.calls[0]![0];
    expect(updateArgs.data.status).toBe("CONFIRMED");
    expect(updateArgs.data.confirmedAt).toBeInstanceOf(Date);

    // Notification goes to the *payer* — they need to know their payment was
    // accepted and the debt cleared.
    const notifArgs = notificationCreate.mock.calls[0]![0];
    expect(notifArgs.data.userId).toBe(PAYER);
    expect(notifArgs.data.type).toBe("SETTLEMENT_CONFIRMED");

    // Audit log captures the receiver as actor.
    const auditArgs = auditLogCreate.mock.calls[0]![0];
    expect(auditArgs.data.actorId).toBe(RECEIVER);
    expect(auditArgs.data.action).toBe("CONFIRMED");
  });

  it("rejects FORBIDDEN when called by the payer", async () => {
    settlementFindUnique.mockResolvedValueOnce(pendingSettlement());
    await expect(confirmSettlement(PAYER, SETTLEMENT_ID)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects FORBIDDEN when called by an unrelated user", async () => {
    settlementFindUnique.mockResolvedValueOnce(pendingSettlement());
    await expect(confirmSettlement(OUTSIDER, SETTLEMENT_ID)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects NOT_FOUND when the settlement doesn't exist", async () => {
    settlementFindUnique.mockResolvedValueOnce(null);
    await expect(confirmSettlement(RECEIVER, SETTLEMENT_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects NOT_FOUND when the settlement is soft-deleted", async () => {
    settlementFindUnique.mockResolvedValueOnce({
      ...(pendingSettlement() as Record<string, unknown>),
      deletedAt: new Date(),
    });
    await expect(confirmSettlement(RECEIVER, SETTLEMENT_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects CONFLICT when the settlement is no longer pending", async () => {
    settlementFindUnique.mockResolvedValueOnce({
      ...(pendingSettlement() as Record<string, unknown>),
      status: "CONFIRMED",
    });
    await expect(confirmSettlement(RECEIVER, SETTLEMENT_ID)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("disputeSettlement", () => {
  it("DISPUTES a pending settlement when called by the receiver", async () => {
    settlementFindUnique.mockResolvedValueOnce(pendingSettlement());
    defaultUpdateResult("DISPUTED");

    const result = await disputeSettlement(RECEIVER, SETTLEMENT_ID);
    expect(result.status).toBe("DISPUTED");

    const updateArgs = settlementUpdate.mock.calls[0]![0];
    expect(updateArgs.data.status).toBe("DISPUTED");
    // Disputing must NOT stamp confirmedAt — that field is the marker for
    // "debt cleared" and a disputed settlement leaves the debt in place.
    expect(updateArgs.data.confirmedAt).toBeUndefined();

    const notifArgs = notificationCreate.mock.calls[0]![0];
    expect(notifArgs.data.userId).toBe(PAYER);
    expect(notifArgs.data.type).toBe("SETTLEMENT_DISPUTED");

    const auditArgs = auditLogCreate.mock.calls[0]![0];
    expect(auditArgs.data.action).toBe("DISPUTED");
  });

  it("rejects FORBIDDEN when called by the payer", async () => {
    settlementFindUnique.mockResolvedValueOnce(pendingSettlement());
    await expect(disputeSettlement(PAYER, SETTLEMENT_ID)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects CONFLICT when settlement isn't pending", async () => {
    settlementFindUnique.mockResolvedValueOnce({
      ...(pendingSettlement() as Record<string, unknown>),
      status: "DISPUTED",
    });
    await expect(disputeSettlement(RECEIVER, SETTLEMENT_ID)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
