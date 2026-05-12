import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PremiumCard } from "@/components/ui/premium-card";
import { FadeIn } from "@/components/ui/motion";

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
      <FadeIn>
        <div className="mx-auto max-w-xl">
          {/* Page header */}
          <div className="mb-8">
            <div className="mb-1 flex items-center gap-3">
              <Link
                href="/dashboard"
                aria-label="Back to dashboard"
                className="rounded-full p-1 text-[#8B93A7] transition-colors hover:text-[#F5F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </Link>
              <h1 className="text-xl font-semibold text-[#F5F7FA]">Create a group</h1>
            </div>
            <p className="pl-9 text-sm text-[#8B93A7]">
              Group expenses with people you share them with
            </p>
          </div>

          {/* Form card */}
          <PremiumCard>
            <div className="p-6 sm:p-8">
              <CreateGroupForm />
            </div>
          </PremiumCard>
        </div>
      </FadeIn>
    </DashboardShell>
  );
}
