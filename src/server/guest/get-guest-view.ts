import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

// SPEC §4.6 — public guest view, returned for ghost members presenting their
// guestToken. The shape is deliberately minimal: only what the ghost needs to
// understand and pay their own debt. We never include other members'
// balances, the full expense list, or any group-wide ledger view.
//
// Auth model: knowledge of the 32-byte token IS the credential. The token is
// scoped to a single ghost row, so producing the view requires nothing more
// than `findUnique({ where: { guestToken } })`.

const ZERO = BigInt(0);

export interface GuestExpenseShare {
  expenseId: string;
  title: string;
  date: Date;
  totalAmountPaise: number;
  yourSharePaise: number;
}

export interface GuestDebt {
  receiverId: string;
  receiverDisplayName: string;
  receiverHandle: string;
  receiverUpiId: string | null;
  amountPaise: number;
}

export interface GuestView {
  ghostMemberId: string;
  displayName: string;
  group: {
    id: string;
    name: string;
    currency: string;
  };
  totalOwedPaise: number;
  expenseShares: GuestExpenseShare[];
  debts: GuestDebt[];
}

export async function getGuestView(token: string): Promise<GuestView> {
  if (!token || typeof token !== "string") {
    throw new AppError("NOT_FOUND", "Guest link is invalid.");
  }

  const ghost = await prisma.ghostMember.findUnique({
    where: { guestToken: token },
    select: {
      id: true,
      groupId: true,
      displayName: true,
      status: true,
      group: {
        select: {
          id: true,
          name: true,
          currency: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  // Same 404 for "no such token" and "merged ghost" — neither should leak
  // the existence of other groups, and the merged guest now uses their real
  // login to see balances.
  if (!ghost || ghost.status !== "ACTIVE") {
    throw new AppError("NOT_FOUND", "Guest link is invalid.");
  }
  if (ghost.group.deletedAt || ghost.group.status === "ARCHIVED") {
    throw new AppError("NOT_FOUND", "This group is no longer active.");
  }

  const [participations, payments] = await Promise.all([
    prisma.expenseParticipant.findMany({
      where: {
        ghostMemberId: ghost.id,
        expense: { status: "ACTIVE", deletedAt: null },
      },
      select: {
        amountPaise: true,
        expense: {
          select: {
            id: true,
            title: true,
            date: true,
            totalAmount: true,
            payers: {
              select: {
                amountPaise: true,
                user: {
                  select: { id: true, handle: true, displayName: true, upiId: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.settlement.findMany({
      where: {
        ghostPayerId: ghost.id,
        status: "CONFIRMED",
        deletedAt: null,
      },
      select: {
        amountPaise: true,
        receiverId: true,
      },
    }),
  ]);

  const expenseShares: GuestExpenseShare[] = participations.map((p) => ({
    expenseId: p.expense.id,
    title: p.expense.title,
    date: p.expense.date,
    totalAmountPaise: Number(p.expense.totalAmount),
    yourSharePaise: Number(p.amountPaise),
  }));

  // Per-creditor outstanding debt: for each expense the ghost participated
  // in, attribute the ghost's share back to payers proportional to how much
  // each payer covered. Mirrors `applyExpense` in calculate-balances.ts.
  const debtMap = new Map<
    string,
    { displayName: string; handle: string; upiId: string | null; amount: bigint }
  >();

  for (const p of participations) {
    const share = p.amountPaise;
    if (share === ZERO) continue;
    const payers = p.expense.payers;
    const totalPaid = payers.reduce((s, x) => s + x.amountPaise, ZERO);
    if (totalPaid === ZERO) continue;

    let distributed = ZERO;
    for (let i = 0; i < payers.length; i++) {
      const payer = payers[i]!;
      const isLast = i === payers.length - 1;
      const portion = isLast
        ? share - distributed
        : (share * payer.amountPaise) / totalPaid;
      distributed += portion;
      if (portion === ZERO) continue;

      const existing = debtMap.get(payer.user.id);
      if (existing) {
        existing.amount += portion;
      } else {
        debtMap.set(payer.user.id, {
          displayName: payer.user.displayName,
          handle: payer.user.handle,
          upiId: payer.user.upiId,
          amount: portion,
        });
      }
    }
  }

  // Subtract any prior CONFIRMED settlements the ghost has already paid.
  for (const s of payments) {
    const existing = debtMap.get(s.receiverId);
    if (!existing) continue;
    existing.amount -= s.amountPaise;
  }

  const debts: GuestDebt[] = [];
  let totalOwed = ZERO;
  // forEach over Map.entries() avoids the iterator-protocol path that needs
  // --downlevelIteration or target ≥ es2015 (the project tsconfig sets neither).
  debtMap.forEach((info, receiverId) => {
    if (info.amount <= ZERO) return;
    debts.push({
      receiverId,
      receiverDisplayName: info.displayName,
      receiverHandle: info.handle,
      receiverUpiId: info.upiId,
      amountPaise: Number(info.amount),
    });
    totalOwed += info.amount;
  });
  debts.sort((a, b) => b.amountPaise - a.amountPaise);

  return {
    ghostMemberId: ghost.id,
    displayName: ghost.displayName,
    group: {
      id: ghost.group.id,
      name: ghost.group.name,
      currency: ghost.group.currency,
    },
    totalOwedPaise: Number(totalOwed),
    expenseShares,
    debts,
  };
}
