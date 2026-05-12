import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
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

  return (
    <div>
      <header className="mb-6 flex items-center gap-3">
        <Link
          href={`/groups/${group.id}/recurring`}
          aria-label="Back to recurring"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8B93A7] transition-colors hover:bg-white/[0.04] hover:text-[#F5F7FA]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <h1 className="text-[20px] font-semibold text-[#F5F7FA]">New recurring expense</h1>
      </header>

      <div className="rounded-2xl border border-white/[0.06] bg-[#161B22] p-6 sm:p-8">
        <RecurringForm
          groupId={group.id}
          members={group.members.map((m) => ({
            id: m.user.id,
            displayName: m.user.displayName,
            handle: m.user.handle,
          }))}
        />
      </div>
    </div>
  );
}
