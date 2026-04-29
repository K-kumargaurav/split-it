// Tests for vote-proposal: majority pass, tied expiry → reject, duplicate
// vote rejection, and the cron finalisation path.

const groupMemberFindUnique = jest.fn();
const groupMemberFindMany = jest.fn();
const groupMemberCount = jest.fn();
const proposalFindUnique = jest.fn();
const proposalUpdate = jest.fn();
const proposalVoteFindUnique = jest.fn();
const proposalVoteCreate = jest.fn();
const expenseFindUnique = jest.fn();
const expenseUpdate = jest.fn();
const expensePayerFindMany = jest.fn();
const auditLogCreate = jest.fn();
const notificationCreate = jest.fn();
const notificationCreateMany = jest.fn();
const transaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findUnique: (...a: unknown[]) => groupMemberFindUnique(...a),
      findMany: (...a: unknown[]) => groupMemberFindMany(...a),
      count: (...a: unknown[]) => groupMemberCount(...a),
    },
    expenseProposal: {
      findUnique: (...a: unknown[]) => proposalFindUnique(...a),
      update: (...a: unknown[]) => proposalUpdate(...a),
    },
    proposalVote: {
      findUnique: (...a: unknown[]) => proposalVoteFindUnique(...a),
      create: (...a: unknown[]) => proposalVoteCreate(...a),
    },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
  },
}));

import { finaliseExpired, voteOnProposal } from "@/server/expenses/vote-proposal";

const PROPOSER = "00000000-0000-4000-8000-000000000001";
const VOTER_A = "00000000-0000-4000-8000-000000000002";
const VOTER_B = "00000000-0000-4000-8000-000000000003";
const VOTER_C = "00000000-0000-4000-8000-000000000004";
const GROUP = "00000000-0000-4000-8000-000000000099";
const EXPENSE = "00000000-0000-4000-8000-0000000000ee";
const PROPOSAL = "00000000-0000-4000-8000-0000000000aa";

interface VoteRow {
  voterId: string;
  vote: "APPROVE" | "REJECT";
}

function wireTx(votes: VoteRow[]): void {
  // The transaction body re-fetches the proposal to count votes. We mirror
  // that by exposing the same mocks on the tx client.
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
    return cb({
      proposalVote: {
        create: (args: { data: VoteRow }) => {
          votes.push(args.data);
          return proposalVoteCreate(args);
        },
      },
      expenseProposal: {
        findUnique: () => ({
          id: PROPOSAL,
          status: "PENDING",
          proposedBy: PROPOSER,
          proposedChanges: { kind: "EDIT", patch: { title: "New" } },
          votes,
          expense: { id: EXPENSE, groupId: GROUP, title: "Lunch" },
        }),
        update: proposalUpdate,
      },
      groupMember: { count: groupMemberCount, findMany: groupMemberFindMany },
      expense: { findUnique: expenseFindUnique, update: expenseUpdate },
      expensePayer: { findMany: expensePayerFindMany },
      auditLog: { create: auditLogCreate },
      notification: {
        create: notificationCreate,
        createMany: notificationCreateMany,
      },
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  groupMemberFindUnique.mockResolvedValue({ id: "gm_self" });
  groupMemberFindMany.mockResolvedValue([
    { userId: PROPOSER },
    { userId: VOTER_A },
    { userId: VOTER_B },
    { userId: VOTER_C },
  ]);
  // Default: 4 members → eligible voters = 3, threshold = 1, need > 1 to win.
  groupMemberCount.mockResolvedValue(4);
  proposalVoteFindUnique.mockResolvedValue(null);
});

describe("voteOnProposal — majority approval applies the change", () => {
  it("with 3 eligible voters, 2 approvals → APPROVED and patch applied", async () => {
    const votes: VoteRow[] = [{ voterId: VOTER_A, vote: "APPROVE" }];
    wireTx(votes);
    proposalFindUnique.mockResolvedValue({
      id: PROPOSAL,
      status: "PENDING",
      proposedBy: PROPOSER,
      expiresAt: new Date(Date.now() + 3600_000),
      proposedChanges: { kind: "EDIT", patch: { title: "New" } },
      expense: { id: EXPENSE, groupId: GROUP, title: "Lunch" },
    });
    expenseFindUnique.mockResolvedValueOnce({
      id: EXPENSE,
      title: "Lunch",
      totalAmount: BigInt(900),
      date: new Date("2026-04-01"),
      notes: null,
      splitType: "EQUAL",
      participants: [{ userId: VOTER_A, amountPaise: BigInt(900) }],
    });

    const result = await voteOnProposal(VOTER_B, PROPOSAL, "APPROVE");

    expect(result.status).toBe("APPROVED");
    expect(result.approveCount).toBe(2);
    expect(expenseUpdate).toHaveBeenCalledTimes(1);
    expect(proposalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "APPROVED" } }),
    );
  });
});

describe("voteOnProposal — guards", () => {
  it("rejects the proposer voting on their own proposal (FORBIDDEN)", async () => {
    proposalFindUnique.mockResolvedValue({
      id: PROPOSAL,
      status: "PENDING",
      proposedBy: PROPOSER,
      expiresAt: new Date(Date.now() + 3600_000),
      proposedChanges: { kind: "EDIT", patch: { title: "New" } },
      expense: { id: EXPENSE, groupId: GROUP, title: "Lunch" },
    });

    await expect(
      voteOnProposal(PROPOSER, PROPOSAL, "APPROVE"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a duplicate vote with CONFLICT (409)", async () => {
    proposalFindUnique.mockResolvedValue({
      id: PROPOSAL,
      status: "PENDING",
      proposedBy: PROPOSER,
      expiresAt: new Date(Date.now() + 3600_000),
      proposedChanges: { kind: "EDIT", patch: { title: "New" } },
      expense: { id: EXPENSE, groupId: GROUP, title: "Lunch" },
    });
    proposalVoteFindUnique.mockResolvedValue({ id: "v_existing" });

    await expect(
      voteOnProposal(VOTER_A, PROPOSAL, "APPROVE"),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("rejects voting after the window closes (CONFLICT)", async () => {
    proposalFindUnique.mockResolvedValue({
      id: PROPOSAL,
      status: "PENDING",
      proposedBy: PROPOSER,
      expiresAt: new Date(Date.now() - 1000),
      proposedChanges: { kind: "EDIT", patch: { title: "New" } },
      expense: { id: EXPENSE, groupId: GROUP, title: "Lunch" },
    });

    await expect(
      voteOnProposal(VOTER_A, PROPOSAL, "APPROVE"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("finaliseExpired — ties resolve to REJECTED", () => {
  it("1 approve / 1 reject across 3 eligible voters → REJECTED", async () => {
    const tiedVotes: VoteRow[] = [
      { voterId: VOTER_A, vote: "APPROVE" },
      { voterId: VOTER_B, vote: "REJECT" },
    ];
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        expenseProposal: {
          findUnique: () => ({
            id: PROPOSAL,
            status: "PENDING",
            proposedBy: PROPOSER,
            proposedChanges: { kind: "EDIT", patch: { title: "New" } },
            votes: tiedVotes,
            expense: { id: EXPENSE, groupId: GROUP, title: "Lunch" },
          }),
          update: proposalUpdate,
        },
        groupMember: { count: groupMemberCount, findMany: groupMemberFindMany },
        notification: {
          create: notificationCreate,
          createMany: notificationCreateMany,
        },
      }),
    );

    const outcome = await (await import("@/lib/prisma")).prisma.$transaction(
      (tx) => finaliseExpired(tx as unknown as Parameters<typeof finaliseExpired>[0], PROPOSAL),
    );

    expect(outcome).toBe("REJECTED");
    expect(proposalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REJECTED" } }),
    );
    expect(expenseUpdate).not.toHaveBeenCalled();
    expect(notificationCreate).toHaveBeenCalledTimes(1);
  });
});
