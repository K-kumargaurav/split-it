import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DangerZone } from "@/components/groups/danger-zone";
import { ExportSection } from "@/components/groups/export-section";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import { getGroupById } from "@/server/groups/get-groups";

interface SettingsPageProps {
  params: { id: string };
}

export default async function GroupSettingsPage({ params }: SettingsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let group;
  try {
    group = await getGroupById(session.user.id, params.id);
  } catch (err) {
    if (err instanceof AppError && (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")) {
      notFound();
    }
    throw err;
  }

  const isOwner = group.viewerRole === "OWNER";

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        handle: session.user.handle,
        image: session.user.image ?? null,
      }}
    >
      <div className="mx-auto max-w-3xl">
        <nav className="mb-6 text-sm">
          <Link
            href={`/groups/${group.id}`}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            ← Back to {group.name}
          </Link>
        </nav>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Group settings
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Update general info, change the balance mode, export records, or archive the group.
          </p>
        </header>

        <div className="space-y-6">
          <Section
            title="General"
            description="Visible to everyone in the group."
          >
            <GroupSettingsForm
              group={{
                id: group.id,
                name: group.name,
                description: group.description,
                color: group.color,
                icon: group.icon,
                balanceMode: group.balanceMode,
              }}
              isOwner={isOwner}
            />
          </Section>

          <Section
            title="Export"
            description="Download a PDF report or a CSV of all expenses for the selected date range."
          >
            <ExportSection groupId={group.id} />
          </Section>

          {isOwner ? (
            <section
              aria-labelledby="danger-zone-heading"
              className="rounded-2xl border border-rose-200 bg-rose-50/30 p-6 shadow-sm sm:p-8"
            >
              <header className="mb-4">
                <h2
                  id="danger-zone-heading"
                  className="text-lg font-semibold tracking-tight text-rose-900"
                >
                  Danger zone
                </h2>
                <p className="mt-1 text-sm text-rose-700/80">
                  Archiving requires all settlements to be confirmed first.
                </p>
              </header>
              <DangerZone groupId={group.id} groupName={group.name} />
            </section>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8"
    >
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </header>
      {children}
    </section>
  );
}
