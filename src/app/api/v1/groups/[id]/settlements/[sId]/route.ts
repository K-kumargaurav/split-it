import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import {
  confirmSettlement,
  disputeSettlement,
  type SettlementWithUsers,
} from "@/server/settlements/confirm-settlement";
import { settlementActionSchema } from "@/lib/validations/settlements";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string; sId: string };
}

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

  const parsed = settlementActionSchema.safeParse(raw);
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
    const updated =
      parsed.data.action === "confirm"
        ? await confirmSettlement(session.user.id, params.sId)
        : await disputeSettlement(session.user.id, params.sId);

    // Cross-check that the settlement actually belongs to the group in the
    // path — without this check, a member of group A could PATCH a settlement
    // from group B by guessing its id (membership is gated on the settlement
    // load, not the group in the URL).
    if (updated.groupId !== params.id) {
      return errorResponse("NOT_FOUND", "Settlement not found.", 404);
    }

    return NextResponse.json({ settlement: serializeSettlement(updated) });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(
        `PATCH /api/v1/groups/${params.id}/settlements/${params.sId} failed`,
        err,
      );
    }
    return errorFromThrown(err);
  }
}

function serializeSettlement(s: SettlementWithUsers) {
  return {
    id: s.id,
    groupId: s.groupId,
    amountPaise: Number(s.amountPaise),
    paymentMethod: s.paymentMethod,
    paymentRef: s.paymentRef,
    status: s.status,
    createdAt: s.createdAt,
    confirmedAt: s.confirmedAt,
    // Ghost-paid settlements have payer === null. Surface that so the client
    // can render "Guest <name>" instead of treating the absence as an error.
    payer: s.payer
      ? {
          userId: s.payer.id,
          handle: s.payer.handle,
          displayName: s.payer.displayName,
        }
      : null,
    receiver: {
      userId: s.receiver.id,
      handle: s.receiver.handle,
      displayName: s.receiver.displayName,
    },
  };
}
