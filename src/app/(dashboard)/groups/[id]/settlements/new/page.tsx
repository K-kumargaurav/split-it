import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  SettlementForm,
  type DebtOption,
} from "@/components/settlements/settlement-form";
import { calculateDirectBalances } from "@/server/balance/calculate-balances";
import { getGroupById, type GroupDetail } from "@/server/groups/get-groups";

interface NewSettlementPageProps {
  params: { id: string };
  searchParams: { to?: string };
}

const ZERO = BigInt(0);

export default async function NewSettlementPage({
  params,
  searchParams,
}: NewSettlementPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let group: GroupDetail;
  try {
    group = await getGroupById(session.user.id, params.id);
  } catch (err) {
    if (err instanceof AppError && (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")) {
      notFound();
    }
    throw err;
  }

  const direct = await calculateDirectBalances(group.id, session.user.id);
  const creditorIds = Object.keys(direct).filter((id) => id !== session.user!.id);
  // Pull the receiver's stored UPI VPA so the "Pay via UPI" CTA can deep-link
  // to a real handle rather than synthesising one from the SplitEasy username
  // (which almost never matches the user's actual VPA).
  const upiRecords = creditorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: creditorIds } },
        select: { id: true, upiId: true },
      })
    : [];
  const upiByUserId = new Map(upiRecords.map((u) => [u.id, u.upiId]));
  const debts = toDebtOptions(direct, session.user.id, group.members, upiByUserId);

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        handle: session.user.handle,
        image: session.user.image ?? null,
      }}
    >
      <nav className="mb-6 text-sm">
        <Link href={`/groups/${group.id}`} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          ← Back to {group.name}
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Mark as paid
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Record a payment you&apos;ve already made. The receiver will be asked to
          confirm before the debt clears.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8">
        <SettlementForm
          groupId={group.id}
          debts={debts}
          defaultReceiverId={searchParams.to}
        />
      </section>
    </DashboardShell>
  );
}

// Direct creditors only — these are the people the viewer actually owes per
// the underlying ledger. The form's receiver dropdown is restricted to this
// list so the server-side debt check (in createSettlement) can never reject
// a submission that the form let through.
function toDebtOptions(
  direct: Record<string, Record<string, bigint>>,
  viewerId: string,
  members: GroupDetail["members"],
  upiByUserId: Map<string, string | null>,
): DebtOption[] {
  const options: DebtOption[] = [];
  for (const [creditorId, debts] of Object.entries(direct)) {
    if (creditorId === viewerId) continue;
    const owed = debts[viewerId];
    if (!owed || owed <= ZERO) continue;

    const member = members.find((m) => m.user.id === creditorId);
    if (!member) continue;

    options.push({
      receiverId: creditorId,
      receiverDisplayName: member.user.displayName,
      receiverHandle: member.user.handle,
      receiverUpiId: upiByUserId.get(creditorId) ?? null,
      amountPaise: Number(owed),
    });
  }
  return options.sort((a, b) => b.amountPaise - a.amountPaise);
}
