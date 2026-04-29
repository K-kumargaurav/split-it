import Link from "next/link";

import { signOut } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/logo";
import { NotificationBell } from "@/components/ui/notification-bell";

interface DashboardShellProps {
  user: {
    name: string | null;
    email: string | null;
    handle: string;
    image: string | null;
  };
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const initial = (user.name?.[0] ?? user.handle[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Logo />

          <nav className="flex items-center gap-2">
            <NotificationBell />
            <Link
              href={`/u/${user.handle}`}
              className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
            >
              <Avatar image={user.image} initial={initial} />
              <span className="font-medium">@{user.handle}</span>
            </Link>
            <span className="sm:hidden">
              <Avatar image={user.image} initial={initial} />
            </span>
            <SignOutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">{children}</main>
    </div>
  );
}

function Avatar({ image, initial }: { image: string | null; initial: string }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
    >
      {initial}
    </span>
  );
}

function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className={cn(
          "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition",
          "hover:border-slate-300 hover:bg-slate-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
        )}
      >
        Sign out
      </button>
    </form>
  );
}
