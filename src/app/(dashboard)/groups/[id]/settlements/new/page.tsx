import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
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
  const debts = toDebtOptions(direct, session.user.id, group.members);

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
        <Link href={`/groups/${group.id}`} className="text-slate-500 hover:text-slate-700">
          ← Back to {group.name}
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Mark as paid
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Record a payment you&apos;ve already made. The receiver will be asked to
          confirm before the debt clears.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
      amountPaise: Number(owed),
    });
  }
  return options.sort((a, b) => b.amountPaise - a.amountPaise);
}
