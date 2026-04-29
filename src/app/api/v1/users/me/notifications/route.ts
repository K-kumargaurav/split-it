import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { getNotificationsForUser } from "@/server/notifications/get-notifications";
import { inboxQuerySchema } from "@/lib/validations/notifications";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  const url = new URL(request.url);
  const parsed = inboxQuerySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    filter: url.searchParams.get("filter") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid query parameters.",
      422,
      parsed.error.issues.map((i) => ({
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    );
  }

  try {
    const page = await getNotificationsForUser(
      session.user.id,
      parsed.data.cursor,
      parsed.data.limit,
      parsed.data.filter ?? "all",
    );
    return NextResponse.json(page);
  } catch (err) {
    console.error("GET /users/me/notifications failed", err);
    return errorFromThrown(err);
  }
}
