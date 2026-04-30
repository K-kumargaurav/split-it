import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        handle: session.user.handle,
        image: session.user.image ?? null,
      }}
    >
      <nav className="mb-6 text-sm">
        <Link
          href={`/groups/${group.id}`}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Back to {group.name}
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Add expense
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Drop a receipt to auto-fill amount and date, or enter the details
          manually. Choose how to split the total below.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8">
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
      </section>
    </DashboardShell>
  );
}
