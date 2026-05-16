import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/api-response";
import { emailSchema } from "@/lib/validations/auth";
import { checkEmailExists } from "@/server/auth/check-email";
import { consumeRateLimit, getClientIp } from "@/server/auth/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.object({ email: emailSchema });

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  const parsed = requestSchema.safeParse(raw);
  // Per spec: invalid email format → don't query the DB. We respond as
  // "available" so the client just clears any prior taken-state without
  // showing a misleading "exists" or rate-limiting the obvious-typo path.
  if (!parsed.success) {
    return NextResponse.json({ available: true });
  }

  // 10 req/min per IP, separate bucket from handle-check.
  const ip = getClientIp(request);
  if (!(await consumeRateLimit(`check-email:${ip}`, { max: 10, windowMs: 60_000 }))) {
    return errorResponse("RATE_LIMITED", "Too many checks. Please wait a moment.", 429);
  }

  const result = await checkEmailExists(parsed.data.email);
  return NextResponse.json({ available: !result.exists });
}
