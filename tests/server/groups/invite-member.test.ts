// Tests for inviteMemberByEmail. Both branches — existing user (direct add)
// and new email (pending invite + email send) — go through the same gating
// (membership + capacity + duplicate check) so the failure cases are
// asserted once and the happy paths are split per branch.

const groupFindFirst = jest.fn();
const groupMemberFindUnique = jest.fn();
const groupMemberCreate = jest.fn();
const groupMemberCount = jest.fn();
const userFindFirst = jest.fn();
const userFindUnique = jest.fn();
const groupInviteFindFirst = jest.fn();
const groupInviteCreate = jest.fn();
const auditLogCreate = jest.fn();
const notificationCreate = jest.fn();
const transaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    group: { findFirst: (...a: unknown[]) => groupFindFirst(...a) },
    groupMember: {
      findUnique: (...a: unknown[]) => groupMemberFindUnique(...a),
      create: (...a: unknown[]) => groupMemberCreate(...a),
    },
    user: {
      findFirst: (...a: unknown[]) => userFindFirst(...a),
      findUnique: (...a: unknown[]) => userFindUnique(...a),
    },
    groupInvite: {
      findFirst: (...a: unknown[]) => groupInviteFindFirst(...a),
      create: (...a: unknown[]) => groupInviteCreate(...a),
    },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
  },
}));

const sendGroupInviteEmail = jest.fn();
jest.mock("@/server/email/auth-emails", () => ({
  sendGroupInviteEmail: (...args: unknown[]) => sendGroupInviteEmail(...args),
}));

import { AppError } from "@/lib/errors";
import { inviteMemberByEmail } from "@/server/groups/invite-member";

const OWNER = "00000000-0000-4000-8000-00000000000a";
const NEW_EMAIL = "newuser@example.com";
const EXISTING_USER_ID = "00000000-0000-4000-8000-00000000000b";
const GROUP = "00000000-0000-4000-8000-000000000099";

function wireTransaction(): void {
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      groupMember: { create: groupMemberCreate, count: groupMemberCount },
      groupInvite: { create: groupInviteCreate },
      auditLog: { create: auditLogCreate },
      notification: { create: notificationCreate },
    }),
  );
}

function defaultGroup(memberCount: number = 3): void {
  groupFindFirst.mockResolvedValue({
    id: GROUP,
    name: "Roomies",
    ownerId: OWNER,
    _count: { members: memberCount },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  wireTransaction();
  // Inviter is a member by default — non-member case is covered explicitly.
  groupMemberFindUnique.mockResolvedValue({ id: "gm_owner" });
  // No outstanding pending invite by default.
  groupInviteFindFirst.mockResolvedValue(null);
  // No prior membership for the invitee by default.
  userFindUnique.mockResolvedValue({ displayName: "Alice", handle: "alice" });
  groupMemberCount.mockResolvedValue(3);
  sendGroupInviteEmail.mockResolvedValue(undefined);
});

describe("inviteMemberByEmail — gating", () => {
  it("rejects NOT_FOUND when group is missing or soft-deleted", async () => {
    groupFindFirst.mockResolvedValue(null);
    await expect(
      inviteMemberByEmail(OWNER, GROUP, NEW_EMAIL),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects FORBIDDEN when inviter is not a member", async () => {
    defaultGroup();
    groupMemberFindUnique.mockResolvedValueOnce(null);
    await expect(
      inviteMemberByEmail(OWNER, GROUP, NEW_EMAIL),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects with VALIDATION_ERROR when group is at the 50-member cap", async () => {
    defaultGroup(50);
    await expect(
      inviteMemberByEmail(OWNER, GROUP, NEW_EMAIL),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("50 members"),
    });
  });
});

describe("inviteMemberByEmail — existing user branch", () => {
  beforeEach(() => {
    defaultGroup();
    userFindFirst.mockResolvedValue({
      id: EXISTING_USER_ID,
      handle: "bob",
      displayName: "Bob",
      email: NEW_EMAIL,
    });
  });

  it("adds the user directly when they have an account", async () => {
    groupMemberFindUnique
      .mockResolvedValueOnce({ id: "gm_owner" }) // owner membership check
      .mockResolvedValueOnce(null); // invitee not yet a member

    const result = await inviteMemberByEmail(OWNER, GROUP, NEW_EMAIL);

    expect(result).toMatchObject({
      status: "ADDED_DIRECTLY",
      member: { userId: EXISTING_USER_ID },
    });
    expect(groupMemberCreate).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(groupInviteCreate).not.toHaveBeenCalled();
    expect(sendGroupInviteEmail).not.toHaveBeenCalled();
  });

  it("rejects CONFLICT when invitee is already a member", async () => {
    groupMemberFindUnique
      .mockResolvedValueOnce({ id: "gm_owner" })
      .mockResolvedValueOnce({ id: "gm_existing" }); // already a member

    await expect(
      inviteMemberByEmail(OWNER, GROUP, NEW_EMAIL),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(groupMemberCreate).not.toHaveBeenCalled();
  });
});

describe("inviteMemberByEmail — new email branch", () => {
  beforeEach(() => {
    defaultGroup();
    userFindFirst.mockResolvedValue(null); // no existing account
  });

  it("creates a PENDING invite and emails the recipient", async () => {
    groupInviteCreate.mockResolvedValue({
      id: "inv_1",
      invitedEmail: NEW_EMAIL,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const result = await inviteMemberByEmail(OWNER, GROUP, NEW_EMAIL);

    expect(result).toMatchObject({
      status: "INVITE_SENT",
      invite: { email: NEW_EMAIL },
    });

    // Invite row stores the SHA-256 hash of the token (64 hex chars), not
    // the raw token — that's the security invariant we actually care about.
    const inviteArgs = groupInviteCreate.mock.calls[0]![0];
    expect(inviteArgs.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(inviteArgs.data.status).toBe("PENDING");
    expect(inviteArgs.data.invitedEmail).toBe(NEW_EMAIL);

    // 7-day TTL per SPEC §4.1.
    const ttlMs =
      inviteArgs.data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(6.5 * 24 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 5_000);

    expect(sendGroupInviteEmail).toHaveBeenCalledTimes(1);
    const sendArgs = sendGroupInviteEmail.mock.calls[0]![0];
    expect(sendArgs.to).toBe(NEW_EMAIL);
    expect(sendArgs.ttlDays).toBe(7);
    // Raw token is passed to the mailer but never persisted — verify it's
    // not the same string as the stored hash.
    expect(sendArgs.rawToken).not.toBe(inviteArgs.data.tokenHash);
  });

  it("rejects CONFLICT when a pending invite already exists for the email", async () => {
    groupInviteFindFirst.mockResolvedValue({ id: "existing-pending" });
    await expect(
      inviteMemberByEmail(OWNER, GROUP, NEW_EMAIL),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(groupInviteCreate).not.toHaveBeenCalled();
  });

  it("normalises the email to lowercase before lookup + write", async () => {
    groupInviteCreate.mockResolvedValue({
      id: "inv_2",
      invitedEmail: NEW_EMAIL,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await inviteMemberByEmail(OWNER, GROUP, "NewUser@Example.COM");

    const userArgs = userFindFirst.mock.calls[0]![0];
    expect(userArgs.where.email).toBe("newuser@example.com");
    const inviteArgs = groupInviteCreate.mock.calls[0]![0];
    expect(inviteArgs.data.invitedEmail).toBe("newuser@example.com");
  });

  it("throws VALIDATION_ERROR for an empty email string", async () => {
    await expect(
      inviteMemberByEmail(OWNER, GROUP, "   "),
    ).rejects.toBeInstanceOf(AppError);
  });
});
