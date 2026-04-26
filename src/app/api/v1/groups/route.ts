import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { createGroup } from "@/server/groups/create-group";
import { getGroupsForUser } from "@/server/groups/get-groups";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  try {
    const groups = await getGroupsForUser(session.user.id);
    return NextResponse.json({ groups });
  } catch (err) {
    console.error("GET /api/v1/groups failed", err);
    return errorFromThrown(err);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
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

  try {
    const group = await createGroup(session.user.id, raw);
    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    console.error("POST /api/v1/groups failed", err);
    return errorFromThrown(err);
  }
}
