import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { getGroupById, type GroupDetail } from "@/server/groups/get-groups";

interface NewExpensePageProps {
  params: { id: string };
}

export default async function NewExpensePage({ params }: NewExpensePageProps) {
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

  // Categories include both system + group-custom (groupId match) and the
  // global system categories (groupId null) so the dropdown is non-empty even
  // for groups created before custom categories were seeded.
  const categories = await prisma.category.findMany({
    where: { OR: [{ groupId: params.id }, { groupId: null }] },
    select: { id: true, name: true, emoji: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  // Ghost members live alongside real members for the purposes of choosing
  // who to split an expense with — see SPEC §4.6. They surface as visually
  // distinct options in the form's selectors so the user can include
  // account-less people without rewriting the flow.
  const ghostMembers = await prisma.ghostMember.findMany({
    where: { groupId: params.id, status: "ACTIVE" },
    select: { id: true, displayName: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/groups/${group.id}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-[#8B93A7] transition hover:text-[#F5F7FA]"
          aria-label={`Back to ${group.name}`}
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-[20px] font-semibold text-[#F5F7FA]">
          Add Expense
        </h1>
      </div>

      <ExpenseForm
        groupId={group.id}
        viewerId={session.user.id}
        members={group.members.map((m) => ({
          id: m.user.id,
          displayName: m.user.displayName,
          handle: m.user.handle,
        }))}
        ghostMembers={ghostMembers}
        categories={categories}
      />
    </div>
  );
}
