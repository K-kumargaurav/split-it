import { NextResponse } from "next/server";

import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { OTP_TTL_MS, createEmailOtp } from "@/server/auth/email-otp";
import { hashPassword } from "@/server/auth/password";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";
import { sendEmailOtpEmail } from "@/server/email/auth-emails";
import { upsertUser } from "@/server/auth/upsert-user";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    // Convert Zod issues → AppErrorIssue[] (SPEC §6.0 `details` shape).
    // We preserve all issues (not just first-per-field) so the client can
    // render every inline error in a single round-trip.
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

  const ip = getClientIp(request);
  if (!(await consumeRateLimit(`register:${ip}`))) {
    return errorResponse(
      "RATE_LIMITED",
      "Too many attempts. Please wait a minute and try again.",
      429,
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
      "CONFLICT",
      "An account with this email already exists.",
      409,
      [{ path: ["email"], message: "An account with this email already exists." }],
    );
  }

  const handleOwner = await prisma.user.findUnique({
    where: { handle },
    select: { id: true, deletedAt: true },
  });
  if (handleOwner && !handleOwner.deletedAt) {
    return errorResponse(
      "CONFLICT",
      "This handle is already taken.",
      409,
      [{ path: ["handle"], message: "This handle is already taken." }],
    );
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await upsertUser({
      email,
      name: displayName,
      provider: "credentials",
      emailVerified: false,
      handle,
      passwordHash,
    });

    // Send OTP for email verification. The user must verify before they can
    // sign in — the credentials provider throws EmailNotVerifiedError when
    // emailVerifiedAt is null. The form transitions to an OTP step on
    // otpSent:true and calls signIn("otp", { email, otp }) on success, which
    // sets emailVerifiedAt via upsertUser.
    const code = await createEmailOtp({ email });
    await sendEmailOtpEmail({
      to: email,
      displayName,
      code,
      ttlMinutes: Math.round(OTP_TTL_MS / 60_000),
    });

    return NextResponse.json(
      {
        ok: true,
        otpSent: true,
        user: {
          id: user.id,
          email: user.email,
          handle: user.handle,
          displayName: user.displayName,
        },
      },
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
          "CONFLICT",
          "An account with this email already exists.",
          409,
          [{ path: ["email"], message: "An account with this email already exists." }],
        );
      }
      if (targets.includes("handle")) {
        return errorResponse(
          "CONFLICT",
          "This handle is already taken.",
          409,
          [{ path: ["handle"], message: "This handle is already taken." }],
        );
      }
    }
    console.error("POST /api/v1/auth/register failed", err);
    return errorFromThrown(err);
  }
}