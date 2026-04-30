import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { addGhostMember } from "@/server/groups/add-ghost-member";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  try {
    const ghost = await addGhostMember(session.user.id, params.id, body);
    return NextResponse.json({ ghost }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`POST /api/v1/groups/${params.id}/members/ghost failed`, err);
    }
    return errorFromThrown(err);
  }
}
