import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { invalidateDashboard } from "@/server/dashboard/invalidate";
import { deleteExpense } from "@/server/expenses/delete-expense";
import { proposeExpenseEdit } from "@/server/expenses/propose-edit";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string; expId: string };
}

// PATCH = edit. Self-author edits apply immediately; others go through the
// dispute / proposal flow (SPEC §4.9). The body is the same patch shape
// either way — the server decides which path to take based on createdBy.
export async function PATCH(
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

  try {
    const result = await proposeExpenseEdit(
      session.user.id,
      params.id,
      params.expId,
      raw,
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error(`PATCH /groups/${params.id}/expenses/${params.expId} failed`, err);
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
    const result = await deleteExpense(session.user.id, params.id, params.expId);
    invalidateDashboard(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`DELETE /groups/${params.id}/expenses/${params.expId} failed`, err);
    return errorFromThrown(err);
  }
}
