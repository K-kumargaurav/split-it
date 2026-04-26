import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import {
  createSettlement,
  type CreatedSettlement,
} from "@/server/settlements/create-settlement";
import { getSettlementsForGroup } from "@/server/settlements/get-settlements";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 25;

  try {
    const page = await getSettlementsForGroup(session.user.id, params.id, cursor, limit);
    return NextResponse.json(page);
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`GET /api/v1/groups/${params.id}/settlements failed`, err);
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  try {
    const settlement = await createSettlement(session.user.id, params.id, raw);
    return NextResponse.json(
      { settlement: serializeSettlement(settlement) },
      { status: 201 },
    );
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`POST /api/v1/groups/${params.id}/settlements failed`, err);
    }
    return errorFromThrown(err);
  }
}

// BigInt → number on the way out so the response is JSON-serialisable. Per-
// settlement ceiling (1e9 paise) is well within Number.MAX_SAFE_INTEGER.
function serializeSettlement(s: CreatedSettlement) {
  return {
    id: s.id,
    groupId: s.groupId,
    amountPaise: Number(s.amountPaise),
    paymentMethod: s.paymentMethod,
    paymentRef: s.paymentRef,
    status: s.status,
    createdAt: s.createdAt,
    confirmedAt: s.confirmedAt,
    payer: {
      userId: s.payer.id,
      handle: s.payer.handle,
      displayName: s.payer.displayName,
    },
    receiver: {
      userId: s.receiver.id,
      handle: s.receiver.handle,
      displayName: s.receiver.displayName,
    },
  };
}
