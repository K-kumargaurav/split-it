import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { AuditTimeline, type AuditEntryClient } from "@/components/audit/audit-timeline";
import { getAuditLog } from "@/server/audit/get-audit-log";
import { getGroupById, type GroupDetail } from "@/server/groups/get-groups";

interface AuditPageProps {
  params: { id: string };
}

export default async function AuditPage({ params }: AuditPageProps) {
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

  const initialPage = await getAuditLog(session.user.id, params.id, {}, undefined, 20);
  const initialItems: AuditEntryClient[] = initialPage.items.map((entry) => ({
    id: entry.id,
    actor: entry.actor,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    diffLines: entry.diffLines,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    createdAt: entry.createdAt.toISOString(),
  }));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#F5F7FA] sm:text-3xl">
          Activity
        </h1>
        <p className="mt-1 text-sm text-[#8B93A7]">
          Every edit to expenses, settlements, and members in {group.name}.
        </p>
      </header>

      <AuditTimeline
        groupId={group.id}
        initialItems={initialItems}
        initialNextCursor={initialPage.nextCursor}
        viewerId={session.user.id}
      />
    </div>
  );
}
