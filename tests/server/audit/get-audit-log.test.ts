// Unit tests for getAuditLog. The function is a thin Prisma read with one
// authorization check (group membership) plus a diff-renderer; we mock prisma
// and assert: (a) non-members cannot read, (b) only matching-groupId rows
// surface, (c) the cursor protocol is correct, and (d) UPDATED rows render
// human-readable diff lines.

const groupMemberFindUnique = jest.fn();
const auditLogFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findUnique: (...args: unknown[]) => groupMemberFindUnique(...args),
    },
    auditLog: {
      findMany: (...args: unknown[]) => auditLogFindMany(...args),
    },
  },
}));

import { AppError } from "@/lib/errors";
import { getAuditLog } from "@/server/audit/get-audit-log";

const VIEWER = "00000000-0000-4000-8000-000000000001";
const ACTOR = "00000000-0000-4000-8000-000000000002";
const GROUP = "00000000-0000-4000-8000-0000000000aa";
const OTHER_GROUP = "00000000-0000-4000-8000-0000000000bb";

interface FakeRow {
  id: string;
  groupId: string;
  actorId: string;
  entityType:
    | "EXPENSE"
    | "SETTLEMENT"
    | "MEMBER"
    | "GROUP"
    | "CATEGORY"
    | "RECURRING";
  entityId: string;
  action:
    | "CREATED"
    | "UPDATED"
    | "DELETED"
    | "APPROVED"
    | "REJECTED"
    | "CONFIRMED"
    | "DISPUTED";
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  createdAt: Date;
  actor: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

function fakeActor() {
  return {
    id: ACTOR,
    handle: "kumar",
    displayName: "Kumar",
    avatarUrl: null,
  };
}

function fakeRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: "log_1",
    groupId: GROUP,
    actorId: ACTOR,
    entityType: "EXPENSE",
    entityId: "exp_1",
    action: "UPDATED",
    oldValue: { title: "Lunch", amountPaise: 120000 },
    newValue: { title: "Team Lunch", amountPaise: 135000 },
    diff: {
      title: { from: "Lunch", to: "Team Lunch" },
      amountPaise: { from: 120000, to: 135000 },
    },
    createdAt: new Date("2026-04-30T10:00:00Z"),
    actor: fakeActor(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  groupMemberFindUnique.mockResolvedValue({ id: "gm_self" });
  auditLogFindMany.mockResolvedValue([]);
});

describe("getAuditLog", () => {
  it("rejects non-members with FORBIDDEN", async () => {
    groupMemberFindUnique.mockResolvedValue(null);

    await expect(getAuditLog(VIEWER, GROUP)).rejects.toBeInstanceOf(AppError);
    await expect(getAuditLog(VIEWER, GROUP)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(auditLogFindMany).not.toHaveBeenCalled();
  });

  it("scopes the query to the requested group only", async () => {
    auditLogFindMany.mockResolvedValue([fakeRow({ id: "log_a" })]);

    await getAuditLog(VIEWER, GROUP);

    expect(auditLogFindMany).toHaveBeenCalledTimes(1);
    const arg = auditLogFindMany.mock.calls[0]![0] as { where: { groupId: string } };
    expect(arg.where.groupId).toBe(GROUP);
  });

  it("returns only entries that match the requested group's rows", async () => {
    // Prisma is mocked, but we still assert that the SUT trusts only the
    // matching rows the DB hands back — i.e. it never invents entries.
    auditLogFindMany.mockResolvedValue([
      fakeRow({ id: "log_g1_a", groupId: GROUP }),
      fakeRow({ id: "log_g1_b", groupId: GROUP }),
    ]);

    const page = await getAuditLog(VIEWER, GROUP);

    expect(page.items.map((i) => i.id)).toEqual(["log_g1_a", "log_g1_b"]);
    // Sanity: the query Prisma was invoked with would not match other groups.
    const arg = auditLogFindMany.mock.calls[0]![0] as { where: { groupId: string } };
    expect(arg.where.groupId).not.toBe(OTHER_GROUP);
  });

  it("formats UPDATED diff into human-readable strings", async () => {
    auditLogFindMany.mockResolvedValue([fakeRow()]);

    const page = await getAuditLog(VIEWER, GROUP);

    expect(page.items).toHaveLength(1);
    const lines = page.items[0]!.diffLines;
    expect(lines).toEqual(
      expect.arrayContaining([
        "Title changed from 'Lunch' to 'Team Lunch'",
        "Amount changed from ₹1,200.00 to ₹1,350.00",
      ]),
    );
  });

  it("renders ENUM-like fields verbatim (status PENDING → CONFIRMED)", async () => {
    auditLogFindMany.mockResolvedValue([
      fakeRow({
        entityType: "SETTLEMENT",
        oldValue: { status: "PENDING_CONFIRMATION" },
        newValue: { status: "CONFIRMED" },
        diff: { status: { from: "PENDING_CONFIRMATION", to: "CONFIRMED" } },
      }),
    ]);

    const page = await getAuditLog(VIEWER, GROUP);
    expect(page.items[0]!.diffLines).toContain(
      "Status changed from PENDING_CONFIRMATION to CONFIRMED",
    );
  });

  it("returns no diff lines for non-UPDATED actions", async () => {
    auditLogFindMany.mockResolvedValue([
      fakeRow({ action: "CREATED", diff: null }),
    ]);
    const page = await getAuditLog(VIEWER, GROUP);
    expect(page.items[0]!.diffLines).toEqual([]);
  });

  it("orders by createdAt DESC with id tiebreaker", async () => {
    auditLogFindMany.mockResolvedValue([]);
    await getAuditLog(VIEWER, GROUP);
    const arg = auditLogFindMany.mock.calls[0]![0] as {
      orderBy: { createdAt?: string; id?: string }[];
    };
    expect(arg.orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("requests one extra row to detect more pages", async () => {
    // 21 rows when limit is 20 means there's a next page.
    const rows = Array.from({ length: 21 }, (_, i) =>
      fakeRow({ id: `log_${i}` }),
    );
    auditLogFindMany.mockResolvedValue(rows);

    const page = await getAuditLog(VIEWER, GROUP, {}, undefined, 20);

    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBe("log_19");

    const arg = auditLogFindMany.mock.calls[0]![0] as { take: number };
    expect(arg.take).toBe(21);
  });

  it("returns nextCursor: null when no more rows", async () => {
    auditLogFindMany.mockResolvedValue([fakeRow({ id: "log_only" })]);
    const page = await getAuditLog(VIEWER, GROUP, {}, undefined, 20);
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(1);
  });

  it("passes cursor + skip:1 when paginating", async () => {
    auditLogFindMany.mockResolvedValue([]);
    await getAuditLog(VIEWER, GROUP, {}, "log_cursor_id", 10);
    const arg = auditLogFindMany.mock.calls[0]![0] as {
      skip?: number;
      cursor?: { id: string };
      take: number;
    };
    expect(arg.skip).toBe(1);
    expect(arg.cursor).toEqual({ id: "log_cursor_id" });
    expect(arg.take).toBe(11);
  });

  it("applies entityType + actorId filters to the query", async () => {
    auditLogFindMany.mockResolvedValue([]);
    await getAuditLog(VIEWER, GROUP, {
      entityType: "SETTLEMENT",
      actorId: ACTOR,
    });
    const arg = auditLogFindMany.mock.calls[0]![0] as {
      where: { groupId: string; entityType?: string; actorId?: string };
    };
    expect(arg.where).toEqual({
      groupId: GROUP,
      entityType: "SETTLEMENT",
      actorId: ACTOR,
    });
  });

  it("clamps limit to the [1, 100] range", async () => {
    auditLogFindMany.mockResolvedValue([]);
    await getAuditLog(VIEWER, GROUP, {}, undefined, 9999);
    const arg = auditLogFindMany.mock.calls[0]![0] as { take: number };
    expect(arg.take).toBe(101); // 100 + 1 lookahead
  });
});
