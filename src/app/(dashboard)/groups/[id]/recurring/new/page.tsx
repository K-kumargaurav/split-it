import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
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
    <div>
      <nav className="mb-6 text-sm">
        <Link
          href={`/groups/${group.id}/recurring`}
          className="text-[#8B93A7] transition-colors hover:text-[#F5F7FA]"
        >
          ← Back to recurring
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#F5F7FA] sm:text-3xl">
          New recurring expense
        </h1>
        <p className="mt-1 text-sm text-[#8B93A7]">
          Define how it repeats and we&apos;ll create the expense automatically on each
          scheduled date.
        </p>
      </header>

      <section className="rounded-2xl border border-white/[0.06] bg-[#161B22] p-6 sm:p-8">
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
    </div>
  );
}
