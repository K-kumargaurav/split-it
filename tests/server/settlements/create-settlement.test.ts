// Tests cover the membership / debt validations + the transactional create
// path. We mock the balance module entirely so each test can stipulate the
// "what is owed" without rebuilding a synthetic ledger; the balance algorithm
// itself is tested in tests/server/balance.

const groupMemberFindMany = jest.fn();
const settlementCreate = jest.fn();
const auditLogCreate = jest.fn();
const notificationCreate = jest.fn();
const transaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findMany: (...args: unknown[]) => groupMemberFindMany(...args),
    },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
  },
}));

const calculateDirectBalances = jest.fn();
jest.mock("@/server/balance/calculate-balances", () => ({
  calculateDirectBalances: (...args: unknown[]) => calculateDirectBalances(...args),
}));

import { AppError } from "@/lib/errors";
import { createSettlement } from "@/server/settlements/create-settlement";

const PAYER = "00000000-0000-4000-8000-00000000000a";
const RECEIVER = "00000000-0000-4000-8000-00000000000b";
const STRANGER = "00000000-0000-4000-8000-00000000000c";
const GROUP = "00000000-0000-4000-8000-000000000099";

const p = (n: number): bigint => BigInt(n);

function wireTransaction(): void {
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      settlement: { create: settlementCreate },
      auditLog: { create: auditLogCreate },
      notification: { create: notificationCreate },
    }),
  );
}

function bothMembers(): void {
  groupMemberFindMany.mockResolvedValue([
    { userId: PAYER },
    { userId: RECEIVER },
  ]);
}

function payerOwesReceiver(amountPaise: bigint): void {
  // direct[creditor][debtor] = paise debtor owes creditor
  calculateDirectBalances.mockResolvedValue({
    [RECEIVER]: { [PAYER]: amountPaise },
  });
}

function defaultSettlementCreateResult(amountPaise: number): void {
  settlementCreate.mockResolvedValue({
    id: "s_1",
    groupId: GROUP,
    payerId: PAYER,
    receiverId: RECEIVER,
    amountPaise: BigInt(amountPaise),
    paymentMethod: "UPI",
    paymentRef: null,
    status: "PENDING_CONFIRMATION",
    createdAt: new Date(),
    confirmedAt: null,
    payer: { id: PAYER, handle: "alice", displayName: "Alice" },
    receiver: { id: RECEIVER, handle: "bob", displayName: "Bob" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  wireTransaction();
});

describe("createSettlement — validation gates", () => {
  it("rejects self-settlement", async () => {
    await expect(
      createSettlement(PAYER, GROUP, {
        receiverId: PAYER,
        amountPaise: 1000,
        paymentMethod: "CASH",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(groupMemberFindMany).not.toHaveBeenCalled();
  });

  it("rejects when payer is not a group member (FORBIDDEN)", async () => {
    groupMemberFindMany.mockResolvedValue([{ userId: RECEIVER }]);
    await expect(
      createSettlement(PAYER, GROUP, {
        receiverId: RECEIVER,
        amountPaise: 1000,
        paymentMethod: "CASH",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects when receiver is not a group member", async () => {
    groupMemberFindMany.mockResolvedValue([{ userId: PAYER }]);
    await expect(
      createSettlement(PAYER, GROUP, {
        receiverId: STRANGER,
        amountPaise: 1000,
        paymentMethod: "CASH",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects when no outstanding debt exists", async () => {
    bothMembers();
    calculateDirectBalances.mockResolvedValue({}); // no debts at all
    await expect(
      createSettlement(PAYER, GROUP, {
        receiverId: RECEIVER,
        amountPaise: 1000,
        paymentMethod: "CASH",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("No outstanding debt"),
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects when balance is reversed (receiver owes payer)", async () => {
    bothMembers();
    // direction flipped: payer is the creditor, receiver is the debtor
    calculateDirectBalances.mockResolvedValue({ [PAYER]: { [RECEIVER]: p(5000) } });
    await expect(
      createSettlement(PAYER, GROUP, {
        receiverId: RECEIVER,
        amountPaise: 1000,
        paymentMethod: "CASH",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("No outstanding debt"),
    });
  });

  it("rejects when amount exceeds outstanding debt", async () => {
    bothMembers();
    payerOwesReceiver(p(5000));
    await expect(
      createSettlement(PAYER, GROUP, {
        receiverId: RECEIVER,
        amountPaise: 10000,
        paymentMethod: "CASH",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("exceeds"),
    });
  });

  it("rejects zero / negative amounts at the schema layer", async () => {
    await expect(
      createSettlement(PAYER, GROUP, {
        receiverId: RECEIVER,
        amountPaise: 0,
        paymentMethod: "CASH",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("createSettlement — happy path", () => {
  it("creates settlement, audit log, and notification when payer owes receiver", async () => {
    bothMembers();
    payerOwesReceiver(p(20000));
    defaultSettlementCreateResult(10000);

    const result = await createSettlement(PAYER, GROUP, {
      receiverId: RECEIVER,
      amountPaise: 10000,
      paymentMethod: "UPI",
      paymentRef: "TXN123",
    });

    expect(result.status).toBe("PENDING_CONFIRMATION");
    expect(settlementCreate).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate).toHaveBeenCalledTimes(1);

    // Settlement is written with BigInt amountPaise + PENDING_CONFIRMATION status.
    const settlementArgs = settlementCreate.mock.calls[0]![0];
    expect(settlementArgs.data.amountPaise).toBe(p(10000));
    expect(settlementArgs.data.status).toBe("PENDING_CONFIRMATION");
    expect(settlementArgs.data.payerId).toBe(PAYER);
    expect(settlementArgs.data.receiverId).toBe(RECEIVER);

    // Notification goes to the receiver with the right event type — that's
    // what the receiver's "Confirm payment" inbox row keys off of.
    const notifArgs = notificationCreate.mock.calls[0]![0];
    expect(notifArgs.data.userId).toBe(RECEIVER);
    expect(notifArgs.data.type).toBe("SETTLEMENT_PENDING_CONFIRMATION");
    expect(notifArgs.data.entityType).toBe("SETTLEMENT");

    // Audit log records the actor as the payer.
    const auditArgs = auditLogCreate.mock.calls[0]![0];
    expect(auditArgs.data.actorId).toBe(PAYER);
    expect(auditArgs.data.action).toBe("CREATED");
    expect(auditArgs.data.entityType).toBe("SETTLEMENT");
  });

  it("accepts a partial settlement (amount < outstanding debt)", async () => {
    bothMembers();
    payerOwesReceiver(p(50000));
    defaultSettlementCreateResult(20000);

    await expect(
      createSettlement(PAYER, GROUP, {
        receiverId: RECEIVER,
        amountPaise: 20000,
        paymentMethod: "CASH",
      }),
    ).resolves.toMatchObject({ status: "PENDING_CONFIRMATION" });
  });

  it("accepts a full settlement (amount === outstanding debt)", async () => {
    bothMembers();
    payerOwesReceiver(p(15000));
    defaultSettlementCreateResult(15000);

    await expect(
      createSettlement(PAYER, GROUP, {
        receiverId: RECEIVER,
        amountPaise: 15000,
        paymentMethod: "CASH",
      }),
    ).resolves.toMatchObject({ status: "PENDING_CONFIRMATION" });
  });
});
