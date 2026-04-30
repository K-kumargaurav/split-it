import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { getGroupById } from "@/server/groups/get-groups";
import { archiveGroup, updateGroup } from "@/server/groups/update-group";

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
    const group = await getGroupById(session.user.id, params.id);
    return NextResponse.json({ group });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`GET /api/v1/groups/${params.id} failed`, err);
    }
    return errorFromThrown(err);
  }
}

export async function PATCH(
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
    const group = await updateGroup(session.user.id, params.id, body);
    return NextResponse.json({ group });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`PATCH /api/v1/groups/${params.id} failed`, err);
    }
    return errorFromThrown(err);
  }
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
    await archiveGroup(session.user.id, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`DELETE /api/v1/groups/${params.id} failed`, err);
    }
    return errorFromThrown(err);
  }
}
