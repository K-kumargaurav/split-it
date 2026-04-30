import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function NewGroupPage() {
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
      <div className="mx-auto max-w-2xl">
        <nav className="mb-6 text-sm">
          <Link href="/dashboard" className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            ← Back to dashboard
          </Link>
        </nav>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Create a new group
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Group expenses with the people you share them with — trips, flatmates, or one-off
            dinners.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8">
          <CreateGroupForm />
        </div>
      </div>
    </DashboardShell>
  );
}
