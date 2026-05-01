import { GroupCardSkeleton } from "@/components/dashboard/group-card-skeleton";
import { cn } from "@/lib/cn";

// Suspense fallback for the dashboard route. We render the same chrome the
// real page draws — hero card, quick actions, group grid — as pulsing
// placeholders so the perceived load is just "filling in" rather than a
// blank panel followed by a layout pop.
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <Block className="h-6 w-28 rounded" />
          <div className="flex items-center gap-2">
            <Block className="h-9 w-9 rounded-full" />
            <Block className="h-9 w-9 rounded-xl" />
            <Block className="h-9 w-32 rounded-full" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pb-10 sm:pt-10 lg:py-12">
        <div className="space-y-8">
          <div className="h-44 rounded-3xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 animate-pulse sm:h-52" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Block className="h-20 rounded-2xl" />
            <Block className="h-20 rounded-2xl" />
          </div>

          <div>
            <div className="mb-4 flex items-end justify-between">
              <div className="space-y-2">
                <Block className="h-5 w-28 rounded" />
                <Block className="h-3 w-44 rounded" />
              </div>
              <Block className="h-3 w-16 rounded" />
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <li key={i}>
                  <GroupCardSkeleton />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

function Block({ className }: { className: string }) {
  return <span className={cn("block animate-pulse bg-slate-200 dark:bg-slate-700", className)} />;
}
