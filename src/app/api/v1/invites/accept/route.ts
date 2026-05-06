import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { joinByTokenSchema } from "@/lib/validations/invites";
import { joinViaInviteLink } from "@/server/groups/join-group";

export const runtime = "nodejs";

// Single endpoint for accepting either an email-invite or a shareable-link
// token — `joinViaInviteLink` disambiguates by hash lookup. Authentication
// is required: SPEC §4.1 says the invitee must register or already have an
// account before becoming a member.
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in to accept an invite.", 401);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  const parsed = joinByTokenSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Some fields are invalid.",
      422,
      parsed.error.issues.map((i) => ({
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    );
  }

  try {
    const result = await joinViaInviteLink(
      session.user.id,
      parsed.data.token,
      session.user.email ?? undefined,
    );
    return NextResponse.json(result);
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error("POST /api/v1/invites/accept failed", err);
    }
    return errorFromThrown(err);
  }
}
