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
      currency: true,
      locale: true,
      createdAt: true,
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
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[#F5F7FA]">Profile</h1>
      </header>

      <ProfileForm
        initial={{
          displayName: user.displayName,
          handle: user.handle,
          avatarUrl: user.avatarUrl,
          upiId: user.upiId,
          email: user.email,
          currency: user.currency,
          locale: user.locale,
          createdAt: user.createdAt.toISOString(),
        }}
      />
    </DashboardShell>
  );
}
