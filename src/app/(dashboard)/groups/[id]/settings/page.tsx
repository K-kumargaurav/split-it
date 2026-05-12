import Link from "next/link";
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
    <div className="mx-auto max-w-3xl">
      <nav className="mb-6 text-sm">
        <Link
          href={`/groups/${group.id}`}
          className="text-[#8B93A7] transition-colors hover:text-[#F5F7FA]"
        >
          ← Back to {group.name}
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[#F5F7FA] sm:text-3xl">
          Group settings
        </h1>
        <p className="mt-2 text-sm text-[#8B93A7]">
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
            className="rounded-2xl border border-[#FF4757]/20 bg-[#FF4757]/5 p-6 sm:p-8"
          >
            <header className="mb-4">
              <h2
                id="danger-zone-heading"
                className="text-lg font-semibold tracking-tight text-[#FF4757]"
              >
                Danger zone
              </h2>
              <p className="mt-1 text-sm text-[#FF4757]/70">
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
      className="rounded-2xl border border-white/[0.06] bg-[#161B22] p-6 sm:p-8"
    >
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-[#F5F7FA]">{title}</h2>
        <p className="mt-1 text-sm text-[#8B93A7]">{description}</p>
      </header>
      {children}
    </section>
  );
}
