// We mock @/lib/prisma so the public Prisma-backed functions are testable
// without a live DB. The pure algorithm itself is exercised through the
// `__testing` export (it doesn't touch Prisma at all), so most cases below
// drive that path directly for clarity.

const groupMemberFindUnique = jest.fn();
const expenseFindMany = jest.fn();
const settlementFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findUnique: (...args: unknown[]) => groupMemberFindUnique(...args),
    },
    expense: {
      findMany: (...args: unknown[]) => expenseFindMany(...args),
    },
    settlement: {
      findMany: (...args: unknown[]) => settlementFindMany(...args),
    },
  },
}));

import {
  __testing,
  calculateDirectBalances,
  calculateSimplifiedBalances,
  getUserNetBalance,
} from "@/server/balance/calculate-balances";
import { AppError } from "@/lib/errors";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const D = "00000000-0000-4000-8000-00000000000d";
const GROUP = "00000000-0000-4000-8000-000000000099";

const p = (n: number): bigint => BigInt(n);

beforeEach(() => {
  jest.clearAllMocks();
  groupMemberFindUnique.mockResolvedValue({ id: "gm_self" });
});

describe("calculateDirectBalances — pure algorithm", () => {
  it("A pays ₹300 split equally between A,B,C → B and C each owe A ₹100", () => {
    const direct = __testing.buildDirectFromLedger(
      [
        {
          payers: [{ userId: A, amountPaise: p(30000) }],
          participants: [
            { userId: A, amountPaise: p(10000) },
            { userId: B, amountPaise: p(10000) },
            { userId: C, amountPaise: p(10000) },
          ],
        },
      ],
      [],
    );
    expect(direct[A]?.[B]).toBe(p(10000));
    expect(direct[A]?.[C]).toBe(p(10000));
    expect(direct[B]).toBeUndefined();
    expect(direct[C]).toBeUndefined();
  });

  it("A pays ₹100 + B pays ₹50 split equally between A,B → B owes A ₹25", () => {
    // Each owes ₹75. A paid ₹100, so net A is +25; B paid ₹50, so net B is −25.
    const direct = __testing.buildDirectFromLedger(
      [
        {
          payers: [
            { userId: A, amountPaise: p(10000) },
            { userId: B, amountPaise: p(5000) },
          ],
          participants: [
            { userId: A, amountPaise: p(7500) },
            { userId: B, amountPaise: p(7500) },
          ],
        },
      ],
      [],
    );
    expect(direct[A]?.[B]).toBe(p(2500));
    expect(direct[B]?.[A]).toBeUndefined();
  });

  it("settlement of ₹100 from B→A clears B's debt to A", () => {
    // First expense leaves B owing A ₹100; the settlement clears that debt.
    const direct = __testing.buildDirectFromLedger(
      [
        {
          payers: [{ userId: A, amountPaise: p(20000) }],
          participants: [
            { userId: A, amountPaise: p(10000) },
            { userId: B, amountPaise: p(10000) },
          ],
        },
      ],
      [{ payerId: B, receiverId: A, amountPaise: p(10000) }],
    );
    expect(direct[A]).toBeUndefined();
    expect(direct[B]).toBeUndefined();
  });

  it("partial settlement only reduces the debt by the settlement amount", () => {
    const direct = __testing.buildDirectFromLedger(
      [
        {
          payers: [{ userId: A, amountPaise: p(20000) }],
          participants: [
            { userId: A, amountPaise: p(10000) },
            { userId: B, amountPaise: p(10000) },
          ],
        },
      ],
      [{ payerId: B, receiverId: A, amountPaise: p(4000) }],
    );
    expect(direct[A]?.[B]).toBe(p(6000));
  });

  it("settles to zero and produces no entry when expenses cancel", () => {
    const direct = __testing.buildDirectFromLedger(
      [
        {
          payers: [{ userId: A, amountPaise: p(10000) }],
          participants: [
            { userId: A, amountPaise: p(5000) },
            { userId: B, amountPaise: p(5000) },
          ],
        },
        {
          payers: [{ userId: B, amountPaise: p(10000) }],
          participants: [
            { userId: A, amountPaise: p(5000) },
            { userId: B, amountPaise: p(5000) },
          ],
        },
      ],
      [],
    );
    expect(direct[A]).toBeUndefined();
    expect(direct[B]).toBeUndefined();
  });
});

describe("calculateSimplifiedBalances — chains compress", () => {
  it("A owes B ₹100, B owes C ₹100 → A pays C ₹100 directly", () => {
    const transfers = __testing.simplify({
      [B]: { [A]: p(10000) },
      [C]: { [B]: p(10000) },
    });
    expect(transfers).toEqual([{ from: A, to: C, amount: p(10000) }]);
  });

  it("two-debt fan-out keeps two transfers", () => {
    // A owes B 100, A owes C 100. Net: A=-200, B=+100, C=+100. Already
    // minimal — A→B 100 and A→C 100, total 2 transfers.
    const transfers = __testing.simplify({
      [B]: { [A]: p(10000) },
      [C]: { [A]: p(10000) },
    });
    expect(transfers.length).toBe(2);
    expect(transfers.reduce((s, t) => s + t.amount, p(0))).toBe(p(20000));
    expect(transfers.every((t) => t.from === A)).toBe(true);
  });

  it("4-person chain simplifies to a single transfer", () => {
    // A→B 100, B→C 100, C→D 100. Net: A=-100, D=+100, B=C=0.
    const transfers = __testing.simplify({
      [B]: { [A]: p(10000) },
      [C]: { [B]: p(10000) },
      [D]: { [C]: p(10000) },
    });
    expect(transfers).toEqual([{ from: A, to: D, amount: p(10000) }]);
  });

  it("returns no transfers when everyone is settled", () => {
    expect(__testing.simplify({})).toEqual([]);
  });
});

describe("Prisma-backed wrappers", () => {
  it("calculateDirectBalances throws FORBIDDEN for non-members", async () => {
    groupMemberFindUnique.mockResolvedValueOnce(null);
    await expect(calculateDirectBalances(GROUP, A)).rejects.toBeInstanceOf(AppError);
  });

  it("calculateDirectBalances loads ACTIVE expenses + CONFIRMED settlements", async () => {
    expenseFindMany.mockResolvedValueOnce([
      {
        payers: [{ userId: A, amountPaise: p(30000) }],
        participants: [
          { userId: A, amountPaise: p(10000) },
          { userId: B, amountPaise: p(10000) },
          { userId: C, amountPaise: p(10000) },
        ],
      },
    ]);
    settlementFindMany.mockResolvedValueOnce([]);

    const direct = await calculateDirectBalances(GROUP, A);
    expect(direct[A]?.[B]).toBe(p(10000));
    expect(direct[A]?.[C]).toBe(p(10000));

    // Confirm we filter on the right enum values — the SUT must never
    // include disputed/cancelled rows (those would corrupt the ledger).
    const expenseWhere = expenseFindMany.mock.calls[0]![0].where;
    expect(expenseWhere.status).toBe("ACTIVE");
    expect(expenseWhere.deletedAt).toBeNull();
    const settlementWhere = settlementFindMany.mock.calls[0]![0].where;
    expect(settlementWhere.status).toBe("CONFIRMED");
    expect(settlementWhere.deletedAt).toBeNull();
  });

  it("calculateSimplifiedBalances composes direct + simplify", async () => {
    expenseFindMany.mockResolvedValueOnce([
      {
        payers: [{ userId: B, amountPaise: p(10000) }],
        participants: [{ userId: A, amountPaise: p(10000) }],
      },
      {
        payers: [{ userId: C, amountPaise: p(10000) }],
        participants: [{ userId: B, amountPaise: p(10000) }],
      },
    ]);
    settlementFindMany.mockResolvedValueOnce([]);

    const transfers = await calculateSimplifiedBalances(GROUP, A);
    expect(transfers).toEqual([{ from: A, to: C, amount: p(10000) }]);
  });

  it("getUserNetBalance returns positive when others owe the user", async () => {
    expenseFindMany.mockResolvedValueOnce([
      {
        payers: [{ userId: A, amountPaise: p(30000) }],
        participants: [
          { userId: A, amountPaise: p(10000) },
          { userId: B, amountPaise: p(10000) },
          { userId: C, amountPaise: p(10000) },
        ],
      },
    ]);
    settlementFindMany.mockResolvedValueOnce([]);
    expect(await getUserNetBalance(GROUP, A)).toBe(p(20000));
  });

  it("getUserNetBalance returns negative when the user owes others", async () => {
    expenseFindMany.mockResolvedValueOnce([
      {
        payers: [{ userId: A, amountPaise: p(30000) }],
        participants: [
          { userId: A, amountPaise: p(10000) },
          { userId: B, amountPaise: p(10000) },
          { userId: C, amountPaise: p(10000) },
        ],
      },
    ]);
    settlementFindMany.mockResolvedValueOnce([]);
    expect(await getUserNetBalance(GROUP, B)).toBe(p(-10000));
  });

  it("getUserNetBalance returns zero when settled", async () => {
    expenseFindMany.mockResolvedValueOnce([
      {
        payers: [{ userId: A, amountPaise: p(20000) }],
        participants: [
          { userId: A, amountPaise: p(10000) },
          { userId: B, amountPaise: p(10000) },
        ],
      },
    ]);
    settlementFindMany.mockResolvedValueOnce([
      { payerId: B, receiverId: A, amountPaise: p(10000) },
    ]);
    expect(await getUserNetBalance(GROUP, A)).toBe(p(0));
  });
});
