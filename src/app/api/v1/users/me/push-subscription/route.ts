import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { pushSubscriptionSchema } from "@/lib/validations/notifications";

export const runtime = "nodejs";

// Register or refresh a push subscription. The browser produces this object
// via PushManager.subscribe() — we persist endpoint+keys so the server can
// later send VAPID-signed pushes (see /server/notifications/web-push.ts).
//
// Endpoints are unique across users. If the same endpoint already exists
// (e.g. user reinstalled, switched accounts), we re-bind it to the current
// user — that prevents the previous owner from continuing to receive
// pushes for this device.
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

  const parsed = pushSubscriptionSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid push subscription payload.",
      422,
      parsed.error.issues.map((i) => ({
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    );
  }

  try {
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      create: {
        userId: session.user.id,
        endpoint: parsed.data.endpoint,
        keys: parsed.data.keys,
      },
      update: {
        userId: session.user.id,
        keys: parsed.data.keys,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: sub.id });
  } catch (err) {
    console.error("POST /users/me/push-subscription failed", err);
    return errorFromThrown(err);
  }
}

// Allow the client to unsubscribe explicitly (e.g. user toggles off push
// in settings). Body: { endpoint }.
export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  let endpoint: string | null = null;
  try {
    const body = (await request.json()) as { endpoint?: unknown };
    if (typeof body.endpoint === "string") endpoint = body.endpoint;
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }
  if (!endpoint) {
    return errorResponse(
      "VALIDATION_ERROR",
      "endpoint is required.",
      422,
    );
  }

  try {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /users/me/push-subscription failed", err);
    return errorFromThrown(err);
  }
}
