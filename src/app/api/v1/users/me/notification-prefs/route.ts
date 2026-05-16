import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cachedJson, errorFromThrown, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { updateNotificationPrefsSchema } from "@/lib/validations/notifications";

export const runtime = "nodejs";

// GET: return all the user's prefs (one row per event type). Defaults are
// applied client-side; missing rows mean inApp=true, push=true, whatsapp=false.
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  try {
    const prefs = await prisma.notificationPref.findMany({
      where: { userId: session.user.id },
      select: {
        eventType: true,
        inApp: true,
        push: true,
        whatsappSms: true,
      },
    });
    return cachedJson({ prefs });
  } catch (err) {
    console.error("GET /users/me/notification-prefs failed", err);
    return errorFromThrown(err);
  }
}

// PATCH: upsert prefs for one or more event types. Body:
//   { prefs: [{ eventType, inApp?, push?, whatsappSms? }, ...] }
export async function PATCH(request: Request): Promise<NextResponse> {
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

  const parsed = updateNotificationPrefsSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid prefs payload.",
      422,
      parsed.error.issues.map((i) => ({
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    );
  }

  const userId = session.user.id;

  try {
    await prisma.$transaction(
      parsed.data.prefs.map((p) =>
        prisma.notificationPref.upsert({
          where: { userId_eventType: { userId, eventType: p.eventType } },
          create: {
            userId,
            eventType: p.eventType,
            inApp: p.inApp ?? true,
            push: p.push ?? true,
            whatsappSms: p.whatsappSms ?? false,
          },
          update: {
            ...(p.inApp !== undefined ? { inApp: p.inApp } : {}),
            ...(p.push !== undefined ? { push: p.push } : {}),
            ...(p.whatsappSms !== undefined
              ? { whatsappSms: p.whatsappSms }
              : {}),
          },
        }),
      ),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /users/me/notification-prefs failed", err);
    return errorFromThrown(err);
  }
}
