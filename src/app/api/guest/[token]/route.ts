import { NextResponse } from "next/server";

import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { createGuestSettlement } from "@/server/guest/create-guest-settlement";
import { getGuestView } from "@/server/guest/get-guest-view";

export const runtime = "nodejs";

interface RouteContext {
  params: { token: string };
}

// PUBLIC route — knowledge of the guestToken IS the credential. We do not
// call `auth()` here on purpose; the SPEC requires guests be able to see
// their own balance and mark debts paid without a SplitEasy account.

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const view = await getGuestView(params.token);
    return NextResponse.json({ view });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error("GET /api/guest/[token] failed", err);
    }
    return errorFromThrown(err);
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  try {
    const settlement = await createGuestSettlement(params.token, body);
    return NextResponse.json(
      {
        settlement: {
          id: settlement.id,
          amountPaise: Number(settlement.amountPaise),
          status: settlement.status,
          receiver: {
            userId: settlement.receiver.id,
            displayName: settlement.receiver.displayName,
            handle: settlement.receiver.handle,
          },
          ghostPayerName: settlement.ghostPayerName,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error("POST /api/guest/[token] failed", err);
    }
    return errorFromThrown(err);
  }
}
