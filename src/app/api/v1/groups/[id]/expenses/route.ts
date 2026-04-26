import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { createExpense, type CreatedExpense } from "@/server/expenses/create-expense";
import { getExpensesForGroup } from "@/server/expenses/get-expenses";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 25;

  try {
    const page = await getExpensesForGroup(session.user.id, params.id, cursor, limit);
    return NextResponse.json(page);
  } catch (err) {
    console.error(`GET /api/v1/groups/${params.id}/expenses failed`, err);
    return errorFromThrown(err);
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
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

  try {
    const expense = await createExpense(session.user.id, params.id, raw);
    return NextResponse.json({ expense: serializeExpense(expense) }, { status: 201 });
  } catch (err) {
    console.error(`POST /api/v1/groups/${params.id}/expenses failed`, err);
    return errorFromThrown(err);
  }
}

// BigInt → number on the way out so the response is JSON-serialisable. The
// per-expense ceiling (1e9 paise) is well within Number.MAX_SAFE_INTEGER.
function serializeExpense(e: CreatedExpense) {
  return {
    id: e.id,
    title: e.title,
    totalAmountPaise: Number(e.totalAmount),
    splitType: e.splitType,
    date: e.date,
    createdAt: e.createdAt,
    payers: e.payers.map((p) => ({
      userId: p.userId,
      handle: p.user.handle,
      displayName: p.user.displayName,
      amountPaise: Number(p.amountPaise),
    })),
    participants: e.participants.map((p) => ({
      userId: p.userId,
      handle: p.user.handle,
      displayName: p.user.displayName,
      amountPaise: Number(p.amountPaise),
    })),
  };
}
