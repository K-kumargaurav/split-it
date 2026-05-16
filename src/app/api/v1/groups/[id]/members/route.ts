import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cachedJson, errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { getGroupMembers } from "@/server/groups/manage-members";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
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
    const result = await getGroupMembers(session.user.id, params.id);
    return cachedJson({
      members: result.members,
      viewerRole: result.viewerRole,
      ownerId: result.ownerId,
    });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`GET /api/v1/groups/${params.id}/members failed`, err);
    }
    return errorFromThrown(err);
  }
}
