import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/server/auth/password";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";

export const runtime = "nodejs";

type ErrorCode =
  | "VALIDATION_FAILED"
  | "EMAIL_EXISTS"
  | "HANDLE_EXISTS"
  | "RATE_LIMITED"
  | "INTERNAL";

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fieldErrors?: Record<string, string>;
  };
}

function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): NextResponse<ErrorBody> {
  return NextResponse.json({ error: { code, message, fieldErrors } }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "VALIDATION_FAILED", "Invalid JSON body.");
  }

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    // 422 Unprocessable Entity is the more accurate status for Zod-level
    // failures — the JSON parsed fine, the shape is just wrong.
    return errorResponse(
      422,
      "VALIDATION_FAILED",
      "Some fields are invalid.",
      fieldErrors,
    );
  }

  const ip = getClientIp(request);
  if (!consumeRateLimit(`register:${ip}`)) {
    return errorResponse(
      429,
      "RATE_LIMITED",
      "Too many attempts. Please wait a minute and try again.",
    );
  }

  const { email, password, displayName, handle } = parsed.data;

  // Two pre-checks (email then handle) so the client can show a precise
  // inline error per field. We re-check inside the create() catch below to
  // close the race between this lookup and insert.
  const emailOwner = await prisma.user.findUnique({
    where: { email },
    select: { id: true, deletedAt: true },
  });
  if (emailOwner && !emailOwner.deletedAt) {
    return errorResponse(
      409,
      "EMAIL_EXISTS",
      "An account with this email already exists.",
    );
  }

  const handleOwner = await prisma.user.findUnique({
    where: { handle },
    select: { id: true, deletedAt: true },
  });
  if (handleOwner && !handleOwner.deletedAt) {
    return errorResponse(409, "HANDLE_EXISTS", "This handle is already taken.");
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName, handle },
      select: { id: true, email: true, handle: true, displayName: true },
    });
    return NextResponse.json(
      { ok: true, user },
      { status: 201 },
    );
  } catch (err) {
    // Race-resolution: P2002 = unique constraint violation. Map back to the
    // appropriate 409 so the client can re-render the right field error.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      const target = (err as { meta?: { target?: string[] | string } }).meta?.target;
      const targets = Array.isArray(target) ? target : target ? [target] : [];
      if (targets.includes("email")) {
        return errorResponse(
          409,
          "EMAIL_EXISTS",
          "An account with this email already exists.",
        );
      }
      if (targets.includes("handle")) {
        return errorResponse(409, "HANDLE_EXISTS", "This handle is already taken.");
      }
    }
    console.error("POST /api/v1/auth/register failed", err);
    return errorResponse(500, "INTERNAL", "Something went wrong. Please try again.");
  }
}
