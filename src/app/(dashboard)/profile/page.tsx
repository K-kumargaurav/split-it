import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      upiId: true,
    },
  });
  if (!user) notFound();

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        handle: session.user.handle,
        image: session.user.image ?? null,
      }}
    >
      <nav className="mb-6 text-sm">
        <Link
          href="/dashboard"
          className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Back to dashboard
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Update your display name, handle, avatar, and UPI ID.
        </p>
      </header>

      <ProfileForm
        initial={{
          displayName: user.displayName,
          handle: user.handle,
          avatarUrl: user.avatarUrl,
          upiId: user.upiId,
          email: user.email,
        }}
      />
    </DashboardShell>
  );
}
