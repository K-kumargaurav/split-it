import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse, serializePaise } from "@/lib/api-response";
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
  const { limit, cursor } = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(25),
      cursor: z.string().optional(),
    })
    .parse({
      limit: url.searchParams.get("limit"),
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

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

// BigInt → string on the way out via serializePaise — exact at any
// magnitude. Clients call Number()/BigInt() locally if needed.
function serializeSettlement(s: CreatedSettlement) {
  return {
    id: s.id,
    groupId: s.groupId,
    amountPaise: serializePaise(s.amountPaise),
    paymentMethod: s.paymentMethod,
    paymentRef: s.paymentRef,
    status: s.status,
    createdAt: s.createdAt,
    confirmedAt: s.confirmedAt,
    // payer is null for ghost payments (payerId is nullable on the schema).
    // Serialize as a ghost shape so the client can distinguish without a
    // separate flag field.
    payer: s.payer
      ? {
          userId: s.payer.id,
          handle: s.payer.handle,
          displayName: s.payer.displayName,
        }
      : { userId: null, handle: null, displayName: "Guest" },
    receiver: {
      userId: s.receiver.id,
      handle: s.receiver.handle,
      displayName: s.receiver.displayName,
    },
  };
}