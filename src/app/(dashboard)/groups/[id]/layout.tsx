import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getGroupById } from "@/server/groups/get-groups";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { GroupHeader } from "@/components/groups/group-header";
import { GroupLayoutClient } from "@/components/groups/group-layout-client";
import { GroupTabNavClient } from "@/components/groups/group-tab-nav-client";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
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
  const base = `/groups/${group.id}`;

  const tabs = [
    { id: "expenses", label: "Expenses", href: base },
    { id: "balances", label: "Balances", href: `${base}?tab=balances` },
    { id: "recurring", label: "Recurring", href: `${base}/recurring` },
    { id: "members", label: "Members", href: `${base}/members` },
    { id: "audit", label: "Audit", href: `${base}/audit` },
  ];

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        handle: session.user.handle,
        image: session.user.image ?? null,
      }}
    >
      <GroupHeader group={group} showSettings={isOwner} />

      <GroupTabNavClient tabs={tabs} />

      <GroupLayoutClient>{children}</GroupLayoutClient>
    </DashboardShell>
  );
}
