import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import {
  getAuditLog,
  type AuditLogItem,
} from "@/server/audit/get-audit-log";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

const ENTITY_TYPES = [
  "EXPENSE",
  "SETTLEMENT",
  "MEMBER",
  "GROUP",
  "CATEGORY",
  "RECURRING",
] as const;

const queryParamsSchema = z.object({
  entityType: z.enum(ENTITY_TYPES).optional(),
  actorId: z.string().uuid().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  const url = new URL(request.url);
  const parsed = queryParamsSchema.safeParse({
    entityType: url.searchParams.get("entityType") ?? undefined,
    actorId: url.searchParams.get("actorId") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid query parameters.",
      422,
      parsed.error.issues.map((i) => ({
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    );
  }

  try {
    const page = await getAuditLog(
      session.user.id,
      params.id,
      {
        entityType: parsed.data.entityType,
        actorId: parsed.data.actorId,
      },
      parsed.data.cursor,
      parsed.data.limit ?? 20,
    );
    return NextResponse.json({
      items: page.items.map(serializeAuditEntry),
      nextCursor: page.nextCursor,
    });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`GET /api/v1/groups/${params.id}/audit-log failed`, err);
    }
    return errorFromThrown(err);
  }
}

function serializeAuditEntry(entry: AuditLogItem) {
  return {
    id: entry.id,
    actor: entry.actor,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    diffLines: entry.diffLines,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    createdAt: entry.createdAt,
  };
}
