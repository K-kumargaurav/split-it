import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validations/profile";

export const runtime = "nodejs";

// Profile read + update for the authenticated user. PATCH applies a partial
// update; sending "" for nullable fields (avatarUrl, upiId) clears them.
// Handle uniqueness is enforced by the DB index — we map the unique-constraint
// failure to a 409 so the client can show "@asha is taken".

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        upiId: true,
        locale: true,
        currency: true,
      },
    });
    if (!user) {
      return errorResponse("NOT_FOUND", "Profile not found.", 404);
    }
    return NextResponse.json({ user });
  } catch (err) {
    console.error("GET /users/me failed", err);
    return errorFromThrown(err);
  }
}

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

  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid profile payload.",
      422,
      parsed.error.issues.map((i) => ({
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    );
  }

  const data: Prisma.UserUpdateInput = {};
  if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName;
  if (parsed.data.handle !== undefined) data.handle = parsed.data.handle;
  if (parsed.data.avatarUrl !== undefined) data.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.upiId !== undefined) data.upiId = parsed.data.upiId;

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        email: true,
        phone: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        upiId: true,
        locale: true,
        currency: true,
      },
    });
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // P2002 = unique-constraint violation. The only unique columns we touch
      // here are `handle` (and email/phone, which we don't update). Surface
      // "handle taken" as 409 CONFLICT.
      return errorResponse(
        "CONFLICT",
        "That handle is already in use.",
        409,
      );
    }
    console.error("PATCH /users/me failed", err);
    return errorFromThrown(err);
  }
}
