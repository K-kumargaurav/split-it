import { cn } from "@/lib/cn";

// Suspense fallback for the group-detail route. Mirrors the page's header +
// tabs + expense list skeleton so the layout settles in rather than jumping.
export default function GroupLoading() {
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
        <div className="space-y-6">
          <div className="space-y-3">
            <Block className="h-7 w-56 rounded" />
            <Block className="h-4 w-72 rounded" />
          </div>

          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Block key={i} className="h-9 w-24 rounded-xl" />
            ))}
          </div>

          <ul className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Block className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2">
                    <Block className="h-4 w-40 rounded" />
                    <Block className="h-3 w-24 rounded" />
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <Block className="ml-auto h-4 w-20 rounded" />
                  <Block className="ml-auto h-3 w-16 rounded" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}

function Block({ className }: { className: string }) {
  return <span className={cn("block animate-pulse bg-slate-200 dark:bg-slate-700", className)} />;
}
