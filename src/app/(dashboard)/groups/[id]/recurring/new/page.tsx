import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { getGroupById, type GroupDetail } from "@/server/groups/get-groups";

interface NewRecurringPageProps {
  params: { id: string };
}

export default async function NewRecurringPage({ params }: NewRecurringPageProps) {
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

  const categories = await prisma.category.findMany({
    where: { OR: [{ groupId: params.id }, { groupId: null }] },
    select: { id: true, name: true, emoji: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
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
          href={`/groups/${group.id}/recurring`}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Back to recurring
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          New recurring expense
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Define how it repeats and we&apos;ll create the expense automatically on each
          scheduled date.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8">
        <RecurringForm
          groupId={group.id}
          viewerId={session.user.id}
          members={group.members.map((m) => ({
            id: m.user.id,
            displayName: m.user.displayName,
            handle: m.user.handle,
          }))}
          categories={categories}
        />
      </section>
    </DashboardShell>
  );
}
