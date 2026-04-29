import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { markAllAsRead } from "@/server/notifications/get-notifications";

export const runtime = "nodejs";

export async function PATCH(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  try {
    const result = await markAllAsRead(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("PATCH /users/me/notifications/read-all failed", err);
    return errorFromThrown(err);
  }
}
