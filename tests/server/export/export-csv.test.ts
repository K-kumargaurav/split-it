// Mocks must be hoisted via jest.mock() before importing the SUT, since the
// SUT pulls in Prisma at module load.

const groupMemberFindUnique = jest.fn();
const groupFindFirst = jest.fn();
const expenseFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findUnique: (...args: unknown[]) => groupMemberFindUnique(...args),
    },
    group: {
      findFirst: (...args: unknown[]) => groupFindFirst(...args),
    },
    expense: {
      findMany: (...args: unknown[]) => expenseFindMany(...args),
    },
  },
}));

import { AppError } from "@/lib/errors";
import { exportGroupCsv, __testing } from "@/server/export/export-csv";

const USER = "00000000-0000-4000-8000-000000000001";
const GROUP = "00000000-0000-4000-8000-000000000099";

beforeEach(() => {
  jest.clearAllMocks();
  groupMemberFindUnique.mockResolvedValue({ id: "gm_self" });
  groupFindFirst.mockResolvedValue({ id: GROUP, name: "Goa Trip" });
});

function expense(over: Partial<Record<string, unknown>> = {}): unknown {
  return {
    id: "e1",
    title: "Hotel",
    splitType: "EQUAL",
    date: new Date(Date.UTC(2026, 3, 5)),
    totalAmount: BigInt(60000),
    category: { name: "Accommodation" },
    payers: [{ user: { displayName: "Alice" } }],
    participants: [
      { amountPaise: BigInt(20000), user: { displayName: "Alice" } },
      { amountPaise: BigInt(20000), user: { displayName: "Bob" } },
      { amountPaise: BigInt(20000), user: { displayName: "Carol" } },
    ],
    ...over,
  };
}

describe("exportGroupCsv", () => {
  it("rejects non-members with FORBIDDEN", async () => {
    groupMemberFindUnique.mockResolvedValueOnce(null);
    await expect(exportGroupCsv(USER, GROUP, {})).rejects.toBeInstanceOf(AppError);
  });

  it("emits one row per participant per expense", async () => {
    expenseFindMany.mockResolvedValueOnce([expense(), expense({ id: "e2", title: "Dinner" })]);

    const { csv } = await exportGroupCsv(USER, GROUP, {});
    const lines = csv.trim().split("\n");
    // 1 header + (3 participants × 2 expenses) = 7 lines.
    expect(lines).toHaveLength(7);
  });

  it("formats amounts in rupees with two decimals (not paise)", async () => {
    expenseFindMany.mockResolvedValueOnce([expense()]);
    const { csv } = await exportGroupCsv(USER, GROUP, {});
    // Total 60000 paise → 600.00 INR; share 20000 paise → 200.00 INR.
    expect(csv).toContain("600.00");
    expect(csv).toContain("200.00");
    // Sanity: raw paise should not appear in money columns.
    const lines = csv.split("\n");
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      expect(line).not.toContain('"60000"');
      expect(line).not.toContain('"20000"');
    }
  });

  it("formats dates as DD/MM/YYYY", async () => {
    expenseFindMany.mockResolvedValueOnce([
      expense({ date: new Date(Date.UTC(2026, 0, 9)) }),
    ]);
    const { csv } = await exportGroupCsv(USER, GROUP, {});
    expect(csv).toContain("09/01/2026");
  });

  it("includes participant names in their own column", async () => {
    expenseFindMany.mockResolvedValueOnce([expense()]);
    const { csv } = await exportGroupCsv(USER, GROUP, {});
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
    expect(csv).toContain("Carol");
  });

  it("emits header columns in the documented order", async () => {
    expenseFindMany.mockResolvedValueOnce([]);
    const { csv } = await exportGroupCsv(USER, GROUP, {});
    const header = csv.split("\n")[0]!;
    expect(header).toBe(
      '"date","title","category","paid_by","total_amount_inr","split_type","participant_name","participant_share_inr"',
    );
  });

  it("returns a sensible filename derived from the group name", async () => {
    expenseFindMany.mockResolvedValueOnce([]);
    const { filename } = await exportGroupCsv(USER, GROUP, {});
    expect(filename).toMatch(/^spliteasy-goa-trip\.csv$/);
  });

  it("appends the date range to the filename when provided", async () => {
    expenseFindMany.mockResolvedValueOnce([]);
    const { filename } = await exportGroupCsv(USER, GROUP, {
      startDate: new Date(Date.UTC(2026, 0, 1)),
      endDate: new Date(Date.UTC(2026, 11, 31)),
    });
    expect(filename).toBe("spliteasy-goa-trip-2026-01-01_to_2026-12-31.csv");
  });
});

describe("paiseToRupeesString", () => {
  it("preserves two decimals for sub-rupee values", () => {
    expect(__testing.paiseToRupeesString(BigInt(5))).toBe("0.05");
    expect(__testing.paiseToRupeesString(BigInt(99))).toBe("0.99");
  });

  it("formats whole rupees with .00", () => {
    expect(__testing.paiseToRupeesString(BigInt(10000))).toBe("100.00");
  });

  it("handles negatives", () => {
    expect(__testing.paiseToRupeesString(BigInt(-2550))).toBe("-25.50");
  });
});

describe("formatDateDDMMYYYY", () => {
  it("zero-pads single-digit day and month", () => {
    expect(__testing.formatDateDDMMYYYY(new Date(Date.UTC(2026, 0, 5)))).toBe("05/01/2026");
  });

  it("formats end-of-year correctly", () => {
    expect(__testing.formatDateDDMMYYYY(new Date(Date.UTC(2026, 11, 31)))).toBe("31/12/2026");
  });
});
