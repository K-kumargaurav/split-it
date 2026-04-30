import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import {
  deleteRecurringTemplate,
  updateRecurringTemplate,
} from "@/server/recurring/manage-templates";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string; rId: string };
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
    const template = await updateRecurringTemplate(
      session.user.id,
      params.id,
      params.rId,
      body,
    );
    return NextResponse.json({ template });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(
        `PATCH /api/v1/groups/${params.id}/recurring/${params.rId} failed`,
        err,
      );
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
    await deleteRecurringTemplate(session.user.id, params.id, params.rId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(
        `DELETE /api/v1/groups/${params.id}/recurring/${params.rId} failed`,
        err,
      );
    }
    return errorFromThrown(err);
  }
}
