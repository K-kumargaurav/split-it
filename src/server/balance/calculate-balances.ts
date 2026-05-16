import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

// Direct vs simplified per SPEC §3.4 / §4.5:
//   • The underlying ledger always stores direct pairwise debts.
//   • Simplification is a view-time computation that minimises the number of
//     transactions needed to settle the same net positions.
//
// All money flows through this module as BigInt — the DB stores paise as
// BigInt and we never round-trip through Number, so totals stay exact even
// for large groups with many small expenses.

const ZERO = BigInt(0);

// directBalances[creditorId][debtorId] = paise the debtor owes the creditor.
// Pairs settle to a single direction (the larger leg minus the smaller),
// so the same pair never appears under both keys with non-zero values.
export type BalanceMap = Record<string, Record<string, bigint>>;

export interface SimplifiedTransfer {
  from: string;
  to: string;
  amount: bigint;
}

// Membership gate — every public function below funnels through this so a
// non-member can never coax balance data out of a group they aren't in.
async function assertMember(groupId: string, userId: string): Promise<void> {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!m) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }
}

export interface ExpenseRow {
  payers: { userId: string; amountPaise: bigint }[];
  participants: { userId: string; amountPaise: bigint }[];
}

export interface SettlementRow {
  payerId: string;
  receiverId: string;
  amountPaise: bigint;
}

async function loadLedger(
  groupId: string,
): Promise<{ expenses: ExpenseRow[]; settlements: SettlementRow[] }> {
  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId, status: "ACTIVE", deletedAt: null },
      select: {
        payers: { select: { userId: true, amountPaise: true } },
        participants: { select: { userId: true, amountPaise: true } },
      },
    }),
    // payerId IS NULL ⇒ ghost-paid settlement (ghostPayerId is set instead).
    // Those rows only affect the ghost's outstanding-debt view in
    // get-guest-view; they have no impact on User-pair balances and would
    // narrow to `string | null` without this filter.
    prisma.settlement.findMany({
      where: {
        groupId,
        status: "CONFIRMED",
        deletedAt: null,
        payerId: { not: null },
      },
      select: { payerId: true, receiverId: true, amountPaise: true },
    }),
  ]);
  const userSettlements: SettlementRow[] = settlements
    .filter((s): s is typeof s & { payerId: string } => s.payerId !== null);
  return { expenses, settlements: userSettlements };
}

// Apply a single expense to the running net-per-pair table. For each
// participant who isn't also a payer, every payer covered a fraction of that
// participant's share proportional to how much they paid. We attribute the
// per-participant share back to payers by their paid-fraction; this keeps
// the math consistent for both single-payer and multi-payer expenses.
//
// `net[a][b]` = paise B owes A (positive) — negative just means the
// direction is flipped. We flatten direction at the end, in `flattenNet`.
function applyExpense(net: Map<string, Map<string, bigint>>, e: ExpenseRow): void {
  const totalPaid = e.payers.reduce((s, p) => s + p.amountPaise, ZERO);
  if (totalPaid === ZERO) return;

  for (const part of e.participants) {
    const share = part.amountPaise;
    if (share === ZERO) continue;

    // Distribute the participant's share across payers proportionally.
    // We use integer multiplication then floor-divide; any rounding
    // remainder is dropped onto the last payer so totals balance.
    let distributed = ZERO;
    for (let i = 0; i < e.payers.length; i++) {
      const payer = e.payers[i]!;
      const isLast = i === e.payers.length - 1;
      const portion = isLast
        ? share - distributed
        : (share * payer.amountPaise) / totalPaid;
      distributed += portion;

      if (payer.userId === part.userId) continue; // self-debt is a no-op
      addDebt(net, payer.userId, part.userId, portion);
    }
  }
}

function applySettlement(net: Map<string, Map<string, bigint>>, s: SettlementRow): void {
  // A settlement of X from payer→receiver reduces the debt payer owes
  // receiver by X. We bookkeep that by adding a *reverse* debt of X — the
  // receiver "owes" the payer X — which the flatten step subtracts off the
  // pre-existing forward debt (debt owed by payer to receiver), netting to
  // the correct post-settlement amount.
  addDebt(net, s.payerId, s.receiverId, s.amountPaise);
}

function addDebt(
  net: Map<string, Map<string, bigint>>,
  creditor: string,
  debtor: string,
  amount: bigint,
): void {
  if (creditor === debtor || amount === ZERO) return;
  let inner = net.get(creditor);
  if (!inner) {
    inner = new Map();
    net.set(creditor, inner);
  }
  inner.set(debtor, (inner.get(debtor) ?? ZERO) + amount);
}

// Collapse the bidirectional net table into a one-direction-per-pair
// BalanceMap. For each (a, b) pair: if a is owed more than they owe, the
// net flows a←b; otherwise b←a. Equal cancels to zero.
function flattenNet(net: Map<string, Map<string, bigint>>): BalanceMap {
  const out: BalanceMap = {};
  const seen = new Set<string>();

  const allUsers = new Set<string>();
  net.forEach((inner, creditor) => {
    allUsers.add(creditor);
    inner.forEach((_amount, debtor) => allUsers.add(debtor));
  });

  const userList: string[] = [];
  allUsers.forEach((u) => userList.push(u));

  for (let i = 0; i < userList.length; i++) {
    for (let j = 0; j < userList.length; j++) {
      const a = userList[i]!;
      const b = userList[j]!;
      if (a === b) continue;
      const key = a < b ? a + "|" + b : b + "|" + a;
      if (seen.has(key)) continue;
      seen.add(key);

      const aOwedByB = net.get(a)?.get(b) ?? ZERO;
      const bOwedByA = net.get(b)?.get(a) ?? ZERO;
      const delta = aOwedByB - bOwedByA;
      if (delta > ZERO) {
        (out[a] ??= {})[b] = delta;
      } else if (delta < ZERO) {
        (out[b] ??= {})[a] = -delta;
      }
    }
  }
  return out;
}

export async function calculateDirectBalances(
  groupId: string,
  userId: string,
): Promise<BalanceMap> {
  await assertMember(groupId, userId);
  const { expenses, settlements } = await loadLedger(groupId);

  const net = new Map<string, Map<string, bigint>>();
  for (const e of expenses) applyExpense(net, e);
  for (const s of settlements) applySettlement(net, s);
  return flattenNet(net);
}

// Greedy minimum-cost-flow: pair the largest creditor with the largest
// debtor, settle the smaller of the two, repeat. This isn't the provably
// optimal NP-hard min-transactions solution, but it produces at most
// (n − 1) transfers for n people with non-zero net positions, which is the
// known upper bound for the optimal answer in practice.
function simplify(direct: BalanceMap): SimplifiedTransfer[] {
  const net = new Map<string, bigint>();
  for (const [creditor, debts] of Object.entries(direct)) {
    for (const [debtor, amount] of Object.entries(debts)) {
      net.set(creditor, (net.get(creditor) ?? ZERO) + amount);
      net.set(debtor, (net.get(debtor) ?? ZERO) - amount);
    }
  }

  // Sort users so the algorithm is deterministic across runs — without a
  // stable order the greedy pick can flip between two equal-magnitude
  // creditors, producing different (but equally valid) transfer lists.
  const users: string[] = [];
  net.forEach((_v, k) => users.push(k));
  users.sort();

  const balances: { userId: string; amount: bigint }[] = users
    .map((u) => ({ userId: u, amount: net.get(u) ?? ZERO }))
    .filter((b) => b.amount !== ZERO);

  const transfers: SimplifiedTransfer[] = [];
  while (balances.length > 1) {
    balances.sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0));
    const creditor = balances[0]!;
    const debtor = balances[balances.length - 1]!;
    if (creditor.amount <= ZERO || debtor.amount >= ZERO) break;

    const amount = creditor.amount < -debtor.amount ? creditor.amount : -debtor.amount;
    transfers.push({ from: debtor.userId, to: creditor.userId, amount });
    creditor.amount -= amount;
    debtor.amount += amount;

    if (creditor.amount === ZERO) balances.shift();
    if (debtor.amount === ZERO) balances.pop();
  }
  return transfers;
}

export async function calculateSimplifiedBalances(
  groupId: string,
  userId: string,
): Promise<SimplifiedTransfer[]> {
  const direct = await calculateDirectBalances(groupId, userId);
  return simplify(direct);
}

// Net position for a single user across the whole group.
//   > 0 → others owe you
//   < 0 → you owe others
//   = 0 → settled
// Uses the same direct ledger as `calculateDirectBalances` so the two
// numbers are guaranteed to agree (sum of incoming − sum of outgoing).
export async function getUserNetBalance(
  groupId: string,
  userId: string,
): Promise<bigint> {
  const direct = await calculateDirectBalances(groupId, userId);

  let net = ZERO;
  // Money owed TO the user (creditor leg).
  for (const amount of Object.values(direct[userId] ?? {})) {
    net += amount;
  }
  // Money the user owes others (debtor leg).
  for (const [creditor, debts] of Object.entries(direct)) {
    if (creditor === userId) continue;
    const owed = debts[userId];
    if (owed) net -= owed;
  }
  return net;
}

// Pure in-memory net-balance computation used by the dashboard batch-load path
// in get-groups.ts. Accepts pre-loaded ledger rows so no DB call is made —
// the caller fetches all groups' expenses/settlements in two queries and feeds
// each group's slice here.
export function computeNetBalance(
  expenses: ExpenseRow[],
  settlements: SettlementRow[],
  userId: string,
): bigint {
  const net = new Map<string, Map<string, bigint>>();
  for (const e of expenses) applyExpense(net, e);
  for (const s of settlements) applySettlement(net, s);
  const direct = flattenNet(net);

  let balance = ZERO;
  for (const amount of Object.values(direct[userId] ?? {})) {
    balance += amount;
  }
  for (const [creditor, debts] of Object.entries(direct)) {
    if (creditor === userId) continue;
    const owed = debts[userId];
    if (owed) balance -= owed;
  }
  return balance;
}

// Pure in-memory computation of the full direct balance map. Used by the
// batch-load path and the balances API to avoid redundant DB calls.
export function buildDirectFromLedger(
  expenses: ExpenseRow[],
  settlements: SettlementRow[],
): BalanceMap {
  const net = new Map<string, Map<string, bigint>>();
  for (const e of expenses) applyExpense(net, e);
  for (const s of settlements) applySettlement(net, s);
  return flattenNet(net);
}

// Pure simplification of a direct balance map into minimum transfers.
export { simplify as simplifyBalances };

// Backwards-compatible test export.
export const __testing = { buildDirectFromLedger, simplify };
