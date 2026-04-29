import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { inviteRequestSchema } from "@/lib/validations/invites";
import {
  generateInviteLink,
  inviteMemberByEmail,
} from "@/server/groups/invite-member";

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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  const parsed = inviteRequestSchema.safeParse(raw);
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
    if (parsed.data.type === "email") {
      const result = await inviteMemberByEmail(
        session.user.id,
        params.id,
        parsed.data.email,
      );
      return NextResponse.json(result, { status: 201 });
    }

    const link = await generateInviteLink(session.user.id, params.id, {
      maxUses: parsed.data.maxUses,
    });
    // The raw token is returned ONCE — only the SHA-256 hash is stored, so
    // there is no way to surface this token again on a subsequent fetch.
    return NextResponse.json(
      {
        id: link.id,
        token: link.rawToken,
        maxUses: link.maxUses,
        expiresAt: link.expiresAt,
      },
      { status: 201 },
    );
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`POST /api/v1/groups/${params.id}/invite failed`, err);
    }
    return errorFromThrown(err);
  }
}
