import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AccountSettings } from "@/components/settings/account-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { BackButton } from "@/components/settings/back-button";
import { NotificationSettings } from "@/components/settings/notification-settings";

export const metadata = { title: "Settings — SplitEasy" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton />

      <header className="mb-8">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-text-primary">
          Settings
        </h1>
        <p className="mt-1.5 text-[14px] text-text-secondary">
          Manage notifications, appearance, and account preferences.
        </p>
      </header>

      <div className="space-y-4">
        <Section title="Notifications" description="Choose when you get notified.">
          <NotificationSettings />
        </Section>

        <Section title="Appearance" description="Customize how SplitEasy looks.">
          <AppearanceSettings />
        </Section>

        <Section title="Account" description="Manage your account and data.">
          <AccountSettings />
        </Section>
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
