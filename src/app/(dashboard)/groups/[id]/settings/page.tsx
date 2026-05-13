import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
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
    <div className="mx-auto max-w-2xl">
      {/* Back nav */}
      <nav className="mb-6">
        <Link
          href={`/groups/${group.id}`}
          className="inline-flex items-center gap-1 text-[13px] text-text-secondary transition hover:text-text-primary"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Back to {group.name}
        </Link>
      </nav>

      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-text-primary">
          Group settings
        </h1>
        <p className="mt-1.5 text-[14px] text-text-secondary">
          Update general info, change the balance mode, export records, or archive the group.
        </p>
      </header>

      <div className="space-y-4">
        {/* General settings */}
        <Section title="General" description="Visible to everyone in the group.">
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

        {/* Export */}
        <Section
          title="Export group data"
          description="Download a PDF report or CSV of all expenses."
        >
          <ExportSection groupId={group.id} />
        </Section>

        {/* Danger zone — owner only */}
        {isOwner ? (
          <section
            aria-labelledby="danger-zone-heading"
            className="rounded-3xl border border-error/20 bg-error/5 p-6 sm:p-8"
          >
            <header className="mb-5">
              <h2
                id="danger-zone-heading"
                className="text-[16px] font-semibold tracking-[-0.01em] text-error"
              >
                Danger zone
              </h2>
              <p className="mt-1 text-[13px] text-error/60">
                Archiving requires all settlements to be confirmed first.
              </p>
            </header>
            <DangerZone groupId={group.id} groupName={group.name} />
          </section>
        ) : null}
      </div>
    </div>
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
      className="rounded-3xl border border-white/5 bg-card p-6 shadow-card sm:p-8"
    >
      <header className="mb-5 border-b border-white/[0.05] pb-4">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-text-primary">
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-text-secondary">{description}</p>
      </header>
      {children}
    </section>
  );
}
