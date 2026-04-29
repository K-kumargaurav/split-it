import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { voteSchema } from "@/lib/validations/proposals";
import { voteOnProposal } from "@/server/expenses/vote-proposal";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string; expId: string; propId: string };
}

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  const parsed = voteSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Vote must be APPROVE or REJECT.",
      422,
      parsed.error.issues.map((i) => ({
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    );
  }

  try {
    const result = await voteOnProposal(
      session.user.id,
      params.propId,
      parsed.data.vote,
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error(
      `POST /groups/${params.id}/expenses/${params.expId}/proposals/${params.propId}/vote failed`,
      err,
    );
    return errorFromThrown(err);
  }
}
