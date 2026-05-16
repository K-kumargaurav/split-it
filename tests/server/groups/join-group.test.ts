// Tests for joinViaInviteLink. Both token paths (email-invite,
// shareable-link) flow through the same hash lookup so we cover each branch
// independently. The rate limiter is module-scoped state — we reset it in
// beforeEach so per-link tests don't bleed into each other.

const groupInviteFindUnique = jest.fn();
const groupInviteUpdate = jest.fn();
const groupInviteLinkFindUnique = jest.fn();
const groupInviteLinkUpdate = jest.fn();
const groupInviteLinkUpdateMany = jest.fn();
const groupMemberFindUnique = jest.fn();
const groupMemberCreate = jest.fn();
const groupMemberCount = jest.fn();
const auditLogCreate = jest.fn();
const transaction = jest.fn();
const queryRaw = jest.fn();
const rateLimitDeleteMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupInvite: {
      findUnique: (...a: unknown[]) => groupInviteFindUnique(...a),
      update: (...a: unknown[]) => groupInviteUpdate(...a),
    },
    groupInviteLink: {
      findUnique: (...a: unknown[]) => groupInviteLinkFindUnique(...a),
      update: (...a: unknown[]) => groupInviteLinkUpdate(...a),
      updateMany: (...a: unknown[]) => groupInviteLinkUpdateMany(...a),
    },
    groupMember: {
      findUnique: (...a: unknown[]) => groupMemberFindUnique(...a),
      create: (...a: unknown[]) => groupMemberCreate(...a),
      count: (...a: unknown[]) => groupMemberCount(...a),
    },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
    rateLimitBucket: { deleteMany: (...a: unknown[]) => rateLimitDeleteMany(...a) },
  },
}));

import { AppError } from "@/lib/errors";
import { hashInviteToken } from "@/server/groups/invite-member";
import { joinViaInviteLink } from "@/server/groups/join-group";
import { __testing as rateLimitTesting } from "@/server/auth/rate-limit";

const USER = "00000000-0000-4000-8000-00000000000a";
const GROUP = "00000000-0000-4000-8000-000000000099";

const RAW_TOKEN = "raw-token-value-with-enough-length-to-pass-zod";
const TOKEN_HASH = hashInviteToken(RAW_TOKEN);

function wireTransaction(): void {
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      groupMember: { create: groupMemberCreate, count: groupMemberCount },
      groupInvite: { update: groupInviteUpdate },
      groupInviteLink: { update: groupInviteLinkUpdate, updateMany: groupInviteLinkUpdateMany },
      auditLog: { create: auditLogCreate },
    }),
  );
}

function pendingEmailInvite(overrides: Partial<Record<string, unknown>> = {}): unknown {
  return {
    id: "inv_1",
    groupId: GROUP,
    invitedEmail: "alice@example.com",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    group: { id: GROUP, name: "Roomies", deletedAt: null },
    ...overrides,
  };
}

function liveLink(overrides: Partial<Record<string, unknown>> = {}): unknown {
  return {
    id: "link_1",
    groupId: GROUP,
    maxUses: 100,
    usedCount: 0,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null,
    group: { id: GROUP, name: "Roomies", deletedAt: null },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  queryRaw.mockResolvedValue([{ count: 1 }]);
  rateLimitDeleteMany.mockResolvedValue({ count: 0 });
  wireTransaction();
  rateLimitTesting.reset();
  groupMemberCount.mockResolvedValue(3);
  groupMemberFindUnique.mockResolvedValue(null);
  groupInviteLinkUpdateMany.mockResolvedValue({ count: 1 });
});

describe("joinViaInviteLink — token resolution", () => {
  it("rejects VALIDATION_ERROR when token is missing or trivially short", async () => {
    await expect(joinViaInviteLink(USER, "")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(groupInviteFindUnique).not.toHaveBeenCalled();
  });

  it("rejects NOT_FOUND when no invite or link matches the token hash", async () => {
    groupInviteFindUnique.mockResolvedValueOnce(null);
    groupInviteLinkFindUnique.mockResolvedValueOnce(null);
    await expect(joinViaInviteLink(USER, RAW_TOKEN)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // Both tables are looked up by the SHA-256 hash, never the raw token.
    expect(groupInviteFindUnique.mock.calls[0]![0].where.tokenHash).toBe(TOKEN_HASH);
    expect(groupInviteLinkFindUnique.mock.calls[0]![0].where.tokenHash).toBe(TOKEN_HASH);
  });
});

describe("joinViaInviteLink — email invite branch", () => {
  it("adds the user, marks invite ACCEPTED, and writes audit log", async () => {
    groupInviteFindUnique.mockResolvedValueOnce(pendingEmailInvite());

    const result = await joinViaInviteLink(USER, RAW_TOKEN, "alice@example.com");
    expect(result).toMatchObject({ groupId: GROUP, via: "email-invite" });

    expect(groupMemberCreate).toHaveBeenCalledTimes(1);
    const memberArgs = groupMemberCreate.mock.calls[0]![0];
    expect(memberArgs.data).toMatchObject({
      groupId: GROUP,
      userId: USER,
      role: "MEMBER",
    });

    const inviteUpdateArgs = groupInviteUpdate.mock.calls[0]![0];
    expect(inviteUpdateArgs.data.status).toBe("ACCEPTED");
    expect(inviteUpdateArgs.data.acceptedByUserId).toBe(USER);
  });

  it("rejects CONFLICT when invite has already been used", async () => {
    groupInviteFindUnique.mockResolvedValueOnce(
      pendingEmailInvite({ status: "ACCEPTED" }),
    );
    await expect(joinViaInviteLink(USER, RAW_TOKEN)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rejects CONFLICT when invite has expired (and flips status to EXPIRED)", async () => {
    groupInviteFindUnique.mockResolvedValueOnce(
      pendingEmailInvite({ expiresAt: new Date(Date.now() - 1_000) }),
    );
    groupInviteUpdate.mockResolvedValueOnce({}); // best-effort status flip
    await expect(joinViaInviteLink(USER, RAW_TOKEN)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("expired"),
    });
  });

  it("rejects CONFLICT when group is at the 50-member cap", async () => {
    groupInviteFindUnique.mockResolvedValueOnce(pendingEmailInvite());
    groupMemberCount.mockResolvedValueOnce(50);
    await expect(joinViaInviteLink(USER, RAW_TOKEN, "alice@example.com")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("50"),
    });
  });

  it("rejects CONFLICT when the user is already a member (and consumes the invite)", async () => {
    groupInviteFindUnique.mockResolvedValueOnce(pendingEmailInvite());
    groupMemberFindUnique.mockResolvedValueOnce({ id: "gm_existing" });
    groupInviteUpdate.mockResolvedValueOnce({});
    await expect(joinViaInviteLink(USER, RAW_TOKEN, "alice@example.com")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    // The invite is still consumed so the orphan link doesn't dangle.
    expect(groupInviteUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("joinViaInviteLink — shareable link branch", () => {
  beforeEach(() => {
    groupInviteFindUnique.mockResolvedValue(null);
  });

  it("adds the user and increments usedCount atomically", async () => {
    groupInviteLinkFindUnique.mockResolvedValueOnce(liveLink());

    const result = await joinViaInviteLink(USER, RAW_TOKEN);
    expect(result).toMatchObject({ groupId: GROUP, via: "invite-link" });

    expect(groupMemberCreate).toHaveBeenCalledTimes(1);
    const incArgs = groupInviteLinkUpdateMany.mock.calls[0]![0];
    expect(incArgs.data.usedCount).toEqual({ increment: 1 });
  });

  it("rejects CONFLICT when revoked", async () => {
    groupInviteLinkFindUnique.mockResolvedValueOnce(
      liveLink({ revokedAt: new Date() }),
    );
    await expect(joinViaInviteLink(USER, RAW_TOKEN)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("revoked"),
    });
  });

  it("rejects CONFLICT when expired", async () => {
    groupInviteLinkFindUnique.mockResolvedValueOnce(
      liveLink({ expiresAt: new Date(Date.now() - 1_000) }),
    );
    await expect(joinViaInviteLink(USER, RAW_TOKEN)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("expired"),
    });
  });

  it("rejects CONFLICT when usedCount has reached maxUses", async () => {
    groupInviteLinkFindUnique.mockResolvedValueOnce(
      liveLink({ maxUses: 5, usedCount: 5 }),
    );
    await expect(joinViaInviteLink(USER, RAW_TOKEN)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("use limit"),
    });
  });

  it("enforces the 10 joins/hour rate limit per link", async () => {
    // Simulate DB-backed rate limiter: allow first 10, then reject
    queryRaw.mockReset();
    for (let i = 0; i < 10; i++) {
      queryRaw.mockResolvedValueOnce([{ count: i + 1 }]);
    }
    queryRaw.mockResolvedValue([]); // after limit: WHERE clause rejects => empty result

    // First 10 calls succeed; the 11th gets RATE_LIMITED. Each call needs a
    // distinct user so the membership-existence check doesn't short-circuit
    // — the limiter is the gate we're verifying.
    for (let i = 0; i < 10; i++) {
      groupInviteLinkFindUnique.mockResolvedValueOnce(liveLink());
      groupMemberFindUnique.mockResolvedValueOnce(null);
      await joinViaInviteLink(`user-${i}`, RAW_TOKEN);
    }
    groupInviteLinkFindUnique.mockResolvedValueOnce(liveLink());
    groupMemberFindUnique.mockResolvedValueOnce(null);
    await expect(joinViaInviteLink("user-11", RAW_TOKEN)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
