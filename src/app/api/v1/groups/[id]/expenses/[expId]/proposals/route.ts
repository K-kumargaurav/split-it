import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { proposeExpenseEdit } from "@/server/expenses/propose-edit";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string; expId: string };
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

  try {
    const result = await proposeExpenseEdit(
      session.user.id,
      params.id,
      params.expId,
      raw,
    );
    return NextResponse.json(result, { status: result.applied ? 200 : 201 });
  } catch (err) {
    console.error(
      `POST /groups/${params.id}/expenses/${params.expId}/proposals failed`,
      err,
    );
    return errorFromThrown(err);
  }
}
