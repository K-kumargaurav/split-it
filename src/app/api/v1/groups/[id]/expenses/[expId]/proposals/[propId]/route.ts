import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cachedJson, errorFromThrown, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string; expId: string; propId: string };
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  try {
    const proposal = await loadProposalForViewer(
      session.user.id,
      params.id,
      params.expId,
      params.propId,
    );
    return cachedJson({ proposal });
  } catch (err) {
    console.error(
      `GET /groups/${params.id}/expenses/${params.expId}/proposals/${params.propId} failed`,
      err,
    );
    return errorFromThrown(err);
  }
}

// Cancel own proposal — proposer-only. Sets status = CANCELLED so the
// active-proposal slot is freed for someone else to open a new one.
export async function DELETE(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  try {
    const proposal = await loadProposalForViewer(
      session.user.id,
      params.id,
      params.expId,
      params.propId,
    );
    if (proposal.proposedBy !== session.user.id) {
      throw new AppError("FORBIDDEN", "Only the proposer can cancel a proposal.");
    }
    if (proposal.status !== "PENDING") {
      throw new AppError(
        "CONFLICT",
        `Proposal is already ${proposal.status.toLowerCase()}.`,
      );
    }
    await prisma.expenseProposal.update({
      where: { id: params.propId },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ proposalId: params.propId, status: "CANCELLED" });
  } catch (err) {
    console.error(
      `DELETE /groups/${params.id}/expenses/${params.expId}/proposals/${params.propId} failed`,
      err,
    );
    return errorFromThrown(err);
  }
}

async function loadProposalForViewer(
  userId: string,
  groupId: string,
  expId: string,
  propId: string,
) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!member) throw new AppError("FORBIDDEN", "You don't have access to this group.");

  const proposal = await prisma.expenseProposal.findUnique({
    where: { id: propId },
    include: {
      votes: { select: { voterId: true, vote: true, createdAt: true } },
      expense: { select: { id: true, groupId: true, title: true } },
      proposer: { select: { id: true, displayName: true, handle: true } },
    },
  });
  if (
    !proposal ||
    proposal.expenseId !== expId ||
    proposal.expense.groupId !== groupId
  ) {
    throw new AppError("NOT_FOUND", "Proposal not found.");
  }
  return proposal;
}
