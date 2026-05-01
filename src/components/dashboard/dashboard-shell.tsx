import { Logo } from "@/components/ui/logo";
import { MobileBottomNav } from "@/components/ui/mobile-bottom-nav";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ProfileMenu } from "@/components/ui/profile-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface DashboardShellProps {
  user: {
    name: string | null;
    email: string | null;
    handle: string;
    image: string | null;
  };
  children: React.ReactNode;
}

// App-wide chrome for the signed-in surface. Topbar holds notifications,
// theme toggle, and the avatar dropdown (View profile / Settings / Sign
// out). On small screens the topbar slims down — Sign out moves into the
// avatar menu and a fixed bottom tab bar takes over primary navigation.
//
// The main element gets bottom padding on mobile so the last bit of content
// isn't hidden behind the fixed tab bar.
export function DashboardShell({ user, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Logo />

          <nav className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <ProfileMenu
              displayName={user.name}
              handle={user.handle}
              email={user.email}
              image={user.image}
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pb-10 sm:pt-10 lg:py-12">
        {children}
      </main>

      <MobileBottomNav />
    </div>
  );
}
