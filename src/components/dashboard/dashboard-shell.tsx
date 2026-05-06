import { BottomNav } from "@/components/layouts/bottom-nav";
import { Navbar } from "@/components/layouts/navbar";
import { PageTransition } from "@/components/ui/page-transition";
import { ScrollReset } from "@/components/ui/scroll-reset";

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
// avatar dropdown, and primary nav links. On small screens the topbar slims
// to logo + avatar only; a fixed bottom tab bar takes over navigation.
//
// main gets pb-20 on mobile so the last card isn't hidden behind the tab bar;
// md:pb-0 removes it when the bottom nav is hidden.
export function DashboardShell({ user, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#0E1116]">
      <Navbar
        user={{
          displayName: user.name ?? user.handle,
          handle: user.handle,
          avatarUrl: user.image ?? undefined,
        }}
      />

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-10 md:pb-0 lg:py-12">
        <ScrollReset />
        <PageTransition>
          {children}
        </PageTransition>
      </main>

      <BottomNav />
    </div>
  );
}
