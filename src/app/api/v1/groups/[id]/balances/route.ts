import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  calculateDirectBalances,
  calculateSimplifiedBalances,
  getUserNetBalance,
} from "@/server/balance/calculate-balances";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

interface DirectBalanceEntry {
  creditor: { userId: string; displayName: string; handle: string };
  debtor: { userId: string; displayName: string; handle: string };
  amountPaise: number;
}

interface SimplifiedBalanceEntry {
  from: { userId: string; displayName: string; handle: string };
  to: { userId: string; displayName: string; handle: string };
  amountPaise: number;
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
  const modeParam = url.searchParams.get("mode") ?? "simplified";
  if (modeParam !== "direct" && modeParam !== "simplified") {
    return errorResponse(
      "VALIDATION_ERROR",
      "mode must be 'direct' or 'simplified'.",
      422,
    );
  }

  try {
    const userId = session.user.id;
    const groupId = params.id;

    const netBalance = await getUserNetBalance(groupId, userId);

    if (modeParam === "direct") {
      const direct = await calculateDirectBalances(groupId, userId);
      const userIds = collectUsersFromDirect(direct);
      const userMap = await loadUsers(userIds);
      const entries: DirectBalanceEntry[] = [];
      for (const [creditorId, debts] of Object.entries(direct)) {
        for (const [debtorId, amount] of Object.entries(debts)) {
          const creditor = userMap.get(creditorId);
          const debtor = userMap.get(debtorId);
          if (!creditor || !debtor) continue;
          entries.push({
            creditor,
            debtor,
            amountPaise: Number(amount),
          });
        }
      }
      return NextResponse.json({
        mode: "direct",
        netBalancePaise: Number(netBalance),
        balances: entries,
      });
    }

    const transfers = await calculateSimplifiedBalances(groupId, userId);
    const userIds = new Set<string>();
    for (const t of transfers) {
      userIds.add(t.from);
      userIds.add(t.to);
    }
    const userMap = await loadUsers(userIds);
    const entries: SimplifiedBalanceEntry[] = transfers
      .map((t) => {
        const from = userMap.get(t.from);
        const to = userMap.get(t.to);
        if (!from || !to) return null;
        return { from, to, amountPaise: Number(t.amount) };
      })
      .filter((e): e is SimplifiedBalanceEntry => e !== null);

    return NextResponse.json({
      mode: "simplified",
      netBalancePaise: Number(netBalance),
      balances: entries,
    });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`GET /api/v1/groups/${params.id}/balances failed`, err);
    }
    return errorFromThrown(err);
  }
}

function collectUsersFromDirect(direct: Record<string, Record<string, bigint>>): Set<string> {
  const ids = new Set<string>();
  for (const [creditor, debts] of Object.entries(direct)) {
    ids.add(creditor);
    for (const debtor of Object.keys(debts)) ids.add(debtor);
  }
  return ids;
}

async function loadUsers(
  userIds: Set<string>,
): Promise<Map<string, { userId: string; displayName: string; handle: string }>> {
  if (userIds.size === 0) return new Map();
  const ids: string[] = [];
  userIds.forEach((id) => ids.push(id));
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, handle: true },
  });
  return new Map(
    users.map((u) => [u.id, { userId: u.id, displayName: u.displayName, handle: u.handle }]),
  );
}
