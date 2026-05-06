import { NextResponse } from "next/server";

import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { processRecurringExpenses } from "@/server/recurring/process-recurring";

// SPEC §4.3 + §7 — daily cron sweep that materialises due recurring
// templates into expenses. Auth is a shared `CRON_SECRET` in the
// Authorization header, mirroring the expire-proposals cron.

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return errorResponse("UNAUTHORIZED", "Cron secret invalid.", 401);
  }

  try {
    const ranAt = new Date();
    const result = await processRecurringExpenses(ranAt);
    return NextResponse.json({
      processed: result.processed,
      created: result.created,
      failed: result.failed,
      failures: result.failures,
      ranAt: ranAt.toISOString(),
    });
  } catch (err) {
    console.error("recurring-expenses cron failed", err);
    return errorFromThrown(err);
  }
}

