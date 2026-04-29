import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { markAsRead } from "@/server/notifications/get-notifications";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

export async function PATCH(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  try {
    await markAsRead(session.user.id, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`PATCH /users/me/notifications/${params.id} failed`, err);
    return errorFromThrown(err);
  }
}
