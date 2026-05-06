import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/groups/${group.id}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "#8B93A7",
          }}
          aria-label={`Back to ${group.name}`}
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-[20px] font-semibold text-text-primary">
          Mark as Paid
        </h1>
      </div>

      <SettlementForm
        groupId={group.id}
        debts={debts}
        defaultReceiverId={searchParams.to}
      />
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
