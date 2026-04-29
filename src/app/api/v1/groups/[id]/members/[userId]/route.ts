import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { removeMember } from "@/server/groups/manage-members";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string; userId: string };
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  try {
    await removeMember(session.user.id, params.id, params.userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(
        `DELETE /api/v1/groups/${params.id}/members/${params.userId} failed`,
        err,
      );
    }
    return errorFromThrown(err);
  }
}
