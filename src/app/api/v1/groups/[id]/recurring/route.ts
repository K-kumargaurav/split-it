import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse, serializePaise } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { createRecurringTemplate } from "@/server/recurring/create-template";
import { listRecurringTemplates } from "@/server/recurring/manage-templates";

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
    const templates = await listRecurringTemplates(session.user.id, params.id);
    // BigInt-safe shape: numbers are already cast in the server function.
    return NextResponse.json({ templates });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`GET /api/v1/groups/${params.id}/recurring failed`, err);
    }
    return errorFromThrown(err);
  }
}

export async function POST(
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
    const template = await createRecurringTemplate(session.user.id, params.id, body);
    return NextResponse.json(
      {
        template: {
          ...template,
          amountPaise: serializePaise(template.amountPaise),
          taxAmountPaise: serializePaise(template.taxAmountPaise),
          tipAmountPaise: serializePaise(template.tipAmountPaise),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`POST /api/v1/groups/${params.id}/recurring failed`, err);
    }
    return errorFromThrown(err);
  }
}
