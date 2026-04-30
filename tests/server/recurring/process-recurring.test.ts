// Mocks must hoist before importing the SUT, since it pulls in Prisma at
// module load. We mock just the methods the runner actually calls.

const recurringFindMany = jest.fn();
const recurringUpdate = jest.fn();
const groupMemberFindMany = jest.fn();
const groupMemberFindUnique = jest.fn();
const expenseCreate = jest.fn();
const auditLogCreate = jest.fn();
const transaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    recurringTemplate: {
      findMany: (...args: unknown[]) => recurringFindMany(...args),
      update: (...args: unknown[]) => recurringUpdate(...args),
    },
    groupMember: {
      findMany: (...args: unknown[]) => groupMemberFindMany(...args),
      findUnique: (...args: unknown[]) => groupMemberFindUnique(...args),
    },
    expense: { create: (...args: unknown[]) => expenseCreate(...args) },
    auditLog: { create: (...args: unknown[]) => auditLogCreate(...args) },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
  },
}));

// Silence the post-commit notify path so it doesn't try to query Prisma. The
// runner already wraps the call in `void` and swallows downstream failures,
// but stubbing it keeps test output clean.
jest.mock("@/server/notifications/create-notification", () => ({
  notifyGroupMembersAfterCommit: jest.fn().mockResolvedValue(undefined),
}));

import {
  processRecurringExpenses,
  __testing,
} from "@/server/recurring/process-recurring";

const GROUP = "00000000-0000-4000-8000-000000000099";
const ACTOR = "00000000-0000-4000-8000-000000000001";
const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

interface BuildTemplateInput {
  id?: string;
  amountPaise?: number;
  frequency?: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
  nextRunDate: Date;
  endDate?: Date | null;
  config?: unknown;
}

function buildTemplate(over: BuildTemplateInput): unknown {
  return {
    id: over.id ?? "tpl_1",
    groupId: GROUP,
    title: "Rent",
    categoryId: null,
    amountPaise: BigInt(over.amountPaise ?? 30000),
    taxAmountPaise: BigInt(0),
    tipAmountPaise: BigInt(0),
    frequency: over.frequency ?? "MONTHLY",
    nextRunDate: over.nextRunDate,
    endDate: over.endDate ?? null,
    isActive: true,
    participantConfig: over.config ?? {
      splitType: "EQUAL",
      participantIds: [ALICE, BOB],
    },
    createdBy: ACTOR,
  };
}

function wireTransaction(): void {
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      groupMember: {
        findMany: groupMemberFindMany,
        findUnique: groupMemberFindUnique,
      },
      expense: { create: expenseCreate },
      auditLog: { create: auditLogCreate },
      recurringTemplate: { update: recurringUpdate },
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  wireTransaction();
  groupMemberFindMany.mockResolvedValue([{ userId: ALICE }, { userId: BOB }, { userId: ACTOR }]);
  groupMemberFindUnique.mockResolvedValue({ userId: ACTOR });
  expenseCreate.mockResolvedValue({ id: "exp_1" });
  recurringUpdate.mockResolvedValue({});
  auditLogCreate.mockResolvedValue({});
});

describe("advanceNextRunDate (calendar safety)", () => {
  it("clamps Jan 31 to Feb 28 in a non-leap year on MONTHLY", () => {
    const next = __testing.advanceNextRunDate(
      new Date(Date.UTC(2026, 0, 31)),
      "MONTHLY",
    );
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("clamps Jan 31 to Feb 29 in a leap year on MONTHLY", () => {
    const next = __testing.advanceNextRunDate(
      new Date(Date.UTC(2024, 0, 31)),
      "MONTHLY",
    );
    expect(next.toISOString().slice(0, 10)).toBe("2024-02-29");
  });

  it("rolls Feb 29 → Feb 28 next year on YEARLY", () => {
    const next = __testing.advanceNextRunDate(
      new Date(Date.UTC(2024, 1, 29)),
      "YEARLY",
    );
    expect(next.toISOString().slice(0, 10)).toBe("2025-02-28");
  });

  it("WEEKLY/BIWEEKLY/DAILY are simple day arithmetic", () => {
    const base = new Date(Date.UTC(2026, 3, 1));
    expect(__testing.advanceNextRunDate(base, "DAILY").toISOString().slice(0, 10)).toBe("2026-04-02");
    expect(__testing.advanceNextRunDate(base, "WEEKLY").toISOString().slice(0, 10)).toBe("2026-04-08");
    expect(__testing.advanceNextRunDate(base, "BIWEEKLY").toISOString().slice(0, 10)).toBe("2026-04-15");
  });
});

describe("processRecurringExpenses", () => {
  it("creates a Feb 28 expense from a Jan 31 MONTHLY template", async () => {
    recurringFindMany.mockResolvedValueOnce([
      buildTemplate({
        nextRunDate: new Date(Date.UTC(2026, 0, 31)),
        frequency: "MONTHLY",
      }),
    ]);

    const result = await processRecurringExpenses(new Date(Date.UTC(2026, 0, 31)));

    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);

    expect(expenseCreate).toHaveBeenCalledTimes(1);
    expect(recurringUpdate).toHaveBeenCalledTimes(1);
    const update = recurringUpdate.mock.calls[0]![0] as {
      data: { nextRunDate: Date; isActive?: boolean };
    };
    expect(update.data.nextRunDate.toISOString().slice(0, 10)).toBe("2026-02-28");
    // No endDate set, so the template stays active.
    expect(update.data.isActive).toBe(true);
  });

  it("deactivates a template whose next run would exceed endDate", async () => {
    recurringFindMany.mockResolvedValueOnce([
      buildTemplate({
        id: "tpl_end",
        nextRunDate: new Date(Date.UTC(2026, 3, 15)),
        endDate: new Date(Date.UTC(2026, 4, 1)), // May 1, 2026
        frequency: "MONTHLY",
      }),
    ]);

    await processRecurringExpenses(new Date(Date.UTC(2026, 3, 15)));

    expect(recurringUpdate).toHaveBeenCalledTimes(1);
    const update = recurringUpdate.mock.calls[0]![0] as {
      data: { nextRunDate: Date; isActive?: boolean };
    };
    // After advancing Apr 15 + monthly = May 15, which is > May 1 endDate.
    expect(update.data.nextRunDate.toISOString().slice(0, 10)).toBe("2026-05-15");
    expect(update.data.isActive).toBe(false);
  });

  it("a failing template doesn't stop subsequent templates from processing", async () => {
    recurringFindMany.mockResolvedValueOnce([
      buildTemplate({ id: "tpl_bad", nextRunDate: new Date(Date.UTC(2026, 3, 1)) }),
      buildTemplate({ id: "tpl_good", nextRunDate: new Date(Date.UTC(2026, 3, 1)) }),
    ]);

    // Make the first transaction throw, the second succeed.
    transaction.mockReset();
    transaction
      .mockImplementationOnce(async () => {
        throw new Error("deliberate failure");
      })
      .mockImplementationOnce(async (cb: (tx: unknown) => unknown) =>
        cb({
          groupMember: {
            findMany: groupMemberFindMany,
            findUnique: groupMemberFindUnique,
          },
          expense: { create: expenseCreate },
          auditLog: { create: auditLogCreate },
          recurringTemplate: { update: recurringUpdate },
        }),
      );

    // Silence the expected error log.
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await processRecurringExpenses(new Date(Date.UTC(2026, 3, 1)));

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.created).toBe(1);
    expect(result.failures[0]?.templateId).toBe("tpl_bad");

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
