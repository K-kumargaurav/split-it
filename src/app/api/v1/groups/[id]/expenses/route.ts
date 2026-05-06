import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse, serializePaise } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { createExpense, type CreatedExpense } from "@/server/expenses/create-expense";
import {
  searchExpenses,
  type ExpenseFilters,
} from "@/server/expenses/search-expenses";
import { expenseFiltersSchema } from "@/lib/validations/expenses";

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
  const { limit, cursor } = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(25),
      cursor: z.string().optional(),
    })
    .parse({
      limit: url.searchParams.get("limit"),
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

  // Each filter is keyed off its own param name; we only forward present keys
  // so the schema's `optional()` branches do the right thing.
  const filterRaw: Record<string, string> = {};
  for (const key of [
    "dateFrom",
    "dateTo",
    "categoryId",
    "paidBy",
    "involves",
    "minAmount",
    "maxAmount",
    "keyword",
  ]) {
    const v = url.searchParams.get(key);
    if (v !== null) filterRaw[key] = v;
  }

  const parsed = expenseFiltersSchema.safeParse(filterRaw);
  if (!parsed.success) {
    return errorFromThrown(
      new AppError(
        "VALIDATION_ERROR",
        "Some filters are invalid.",
        parsed.error.issues.map((i) => ({
          path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
          message: i.message,
        })),
      ),
    );
  }

  const filters: ExpenseFilters = {
    dateFrom: parsed.data.dateFrom,
    dateTo: parsed.data.dateTo,
    categoryId: parsed.data.categoryId,
    paidBy: parsed.data.paidBy,
    involves: parsed.data.involves,
    minAmount: parsed.data.minAmount,
    maxAmount: parsed.data.maxAmount,
    keyword: parsed.data.keyword,
  };

  try {
    const page = await searchExpenses(
      session.user.id,
      params.id,
      filters,
      cursor,
      limit,
    );
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

function serializeExpense(e: CreatedExpense) {
  return {
    id: e.id,
    title: e.title,
    totalAmountPaise: serializePaise(e.totalAmount),
    splitType: e.splitType,
    date: e.date,
    createdAt: e.createdAt,
    payers: e.payers.map((p) => ({
      userId: p.userId,
      handle: p.user.handle,
      displayName: p.user.displayName,
      amountPaise: serializePaise(p.amountPaise),
    })),
    participants: e.participants.map((p) => ({
      userId: p.userId,
      handle: p.user.handle,
      displayName: p.user.displayName,
      amountPaise: serializePaise(p.amountPaise),
    })),
  };
}
