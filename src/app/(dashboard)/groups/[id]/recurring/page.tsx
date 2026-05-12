import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { StaggerChildren } from "@/components/ui/motion";
import { RecurringCard } from "@/components/recurring/recurring-actions";
import { getGroupById, type GroupDetail } from "@/server/groups/get-groups";
import {
  listRecurringTemplates,
  type RecurringTemplateRow,
} from "@/server/recurring/manage-templates";

interface RecurringPageProps {
  params: { id: string };
}

function participantCount(config: RecurringTemplateRow["participantConfig"]): number {
  if (!config || typeof config !== "object" || Array.isArray(config)) return 0;
  const c = config as { participantIds?: unknown; splits?: unknown };
  if (Array.isArray(c.participantIds)) return c.participantIds.length;
  if (Array.isArray(c.splits)) return c.splits.length;
  return 0;
}

export default async function RecurringPage({ params }: RecurringPageProps) {
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

  const templates = await listRecurringTemplates(session.user.id, params.id);

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-[#F5F7FA]">Recurring</h1>
          <p className="mt-0.5 text-[13px] text-[#8B93A7]">
            Auto-added on schedule until paused
          </p>
        </div>
        <Link
          href={`/groups/${group.id}/recurring/new`}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#00C896] px-4 text-sm font-semibold text-[#0E1116] transition hover:bg-[#00C896]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896]"
        >
          Add recurring
        </Link>
      </header>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-5 py-16 text-center">
          <RefreshCw className="mb-4 h-10 w-10 text-[#8B93A7]" strokeWidth={1.5} />
          <p className="text-sm font-medium text-[#F5F7FA]">No recurring expenses</p>
          <p className="mt-1 text-sm text-[#8B93A7]">
            Set up rent, subscriptions, or any regular split
          </p>
          <Link
            href={`/groups/${group.id}/recurring/new`}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#00C896] px-4 text-sm font-semibold text-[#0E1116] transition hover:bg-[#00C896]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896]"
          >
            Add recurring
          </Link>
        </div>
      ) : (
        <StaggerChildren className="space-y-3">
          {templates.map((t) => (
            <RecurringCard
              key={t.id}
              groupId={group.id}
              templateId={t.id}
              title={t.title}
              amountPaise={t.amountPaise}
              frequency={t.frequency}
              splitType={t.splitType}
              participantCount={participantCount(t.participantConfig)}
              nextRunDate={t.nextRunDate}
              endDate={t.endDate}
              isActive={t.isActive}
            />
          ))}
        </StaggerChildren>
      )}
    </div>
  );
}
