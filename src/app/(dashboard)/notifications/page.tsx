import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NotificationsFeed } from "@/components/notifications/notifications-feed";

// Full notifications inbox. Server fetches the first page so the user sees
// content immediately; the client component handles "load more" + read/
// unread filtering with SWR.
export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        handle: session.user.handle,
        image: session.user.image ?? null,
      }}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Activity from your groups and settlements.
        </p>
      </header>

      <NotificationsFeed />
    </DashboardShell>
  );
}
