import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cachedJson, errorFromThrown, errorResponse, serializePaise } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  calculateDirectBalances,
  simplifyBalances,
  type BalanceMap,
} from "@/server/balance/calculate-balances";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

// amountPaise is serialized as a string (via serializePaise) on the wire to
// preserve exact values for large groups — Number() silently loses precision
// past 2^53 and balance aggregates across many expenses can exceed that.
interface DirectBalanceEntry {
  creditor: { userId: string; displayName: string; handle: string };
  debtor: { userId: string; displayName: string; handle: string };
  amountPaise: string;
}

interface SimplifiedBalanceEntry {
  from: { userId: string; displayName: string; handle: string };
  to: { userId: string; displayName: string; handle: string };
  amountPaise: string;
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

    // Single DB load — direct balances are computed once, net and simplified
    // are derived in-memory (previously 3 separate DB round-trips).
    const direct = await calculateDirectBalances(groupId, userId);
    const netBalance = deriveNetBalance(direct, userId);

    if (modeParam === "direct") {
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
            amountPaise: serializePaise(amount),
          });
        }
      }
      return cachedJson({
        mode: "direct",
        netBalancePaise: serializePaise(netBalance),
        balances: entries,
      });
    }

    const transfers = simplifyBalances(direct);
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
        return { from, to, amountPaise: serializePaise(t.amount) };
      })
      .filter((e): e is SimplifiedBalanceEntry => e !== null);

    return cachedJson({
      mode: "simplified",
      netBalancePaise: serializePaise(netBalance),
      balances: entries,
    });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`GET /api/v1/groups/${params.id}/balances failed`, err);
    }
    return errorFromThrown(err);
  }
}

function deriveNetBalance(direct: BalanceMap, userId: string): bigint {
  let net = BigInt(0);
  for (const amount of Object.values(direct[userId] ?? {})) {
    net += amount;
  }
  for (const [creditor, debts] of Object.entries(direct)) {
    if (creditor === userId) continue;
    const owed = debts[userId];
    if (owed) net -= owed;
  }
  return net;
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
