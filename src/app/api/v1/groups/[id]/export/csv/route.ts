import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { exportGroupCsv } from "@/server/export/export-csv";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse | Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  const url = new URL(request.url);
  const startDate = parseDate(url.searchParams.get("startDate"));
  const endDate = parseDate(url.searchParams.get("endDate"));
  if (startDate === "invalid" || endDate === "invalid") {
    return errorResponse(
      "VALIDATION_ERROR",
      "startDate and endDate must be ISO date strings.",
      422,
    );
  }

  try {
    const result = await exportGroupCsv(session.user.id, params.id, {
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    });
    return new Response(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`GET /api/v1/groups/${params.id}/export/csv failed`, err);
    }
    return errorFromThrown(err);
  }
}

function parseDate(value: string | null): Date | undefined | "invalid" {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d;
}
