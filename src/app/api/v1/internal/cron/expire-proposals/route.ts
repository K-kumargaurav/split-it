import { NextResponse } from "next/server";

import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { finaliseExpired } from "@/server/expenses/vote-proposal";

// Cron sweep for expired proposals (SPEC §4.9 + §7 "Background jobs"). Runs
// hourly via Vercel Cron — see vercel.json. Authentication is a shared
// secret in the `Authorization` header, matching the pattern Vercel Cron
// uses by default for protected endpoints.

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_LIMIT = 200;

export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return errorResponse("UNAUTHORIZED", "Cron secret invalid.", 401);
  }

  try {
    const now = new Date();
    const expired = await prisma.expenseProposal.findMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      select: { id: true },
      take: BATCH_LIMIT,
    });

    let approved = 0;
    let rejected = 0;
    for (const p of expired) {
      const outcome = await prisma.$transaction((tx) => finaliseExpired(tx, p.id));
      if (outcome === "APPROVED") approved += 1;
      else rejected += 1;
    }

    return NextResponse.json({
      processed: expired.length,
      approved,
      rejected,
      ranAt: now.toISOString(),
    });
  } catch (err) {
    console.error("expire-proposals cron failed", err);
    return errorFromThrown(err);
  }
}

