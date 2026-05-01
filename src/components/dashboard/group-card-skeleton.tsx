import { cn } from "@/lib/cn";

// Visual placeholder for the GroupCard while server data is loading. Mirrors
// the real card's silhouette so the layout doesn't jump on hydration.
export function GroupCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm"
    >
      <span className="absolute inset-x-0 top-0 h-1 bg-slate-200 dark:bg-slate-700" />
      <div className="flex items-start gap-3">
        <Block className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <Block className="h-3.5 w-2/3 rounded" />
          <Block className="h-3 w-1/3 rounded" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <Block className="h-4 w-20 rounded-full" />
        <Block className="h-7 w-32 rounded" />
      </div>
      <Block className="mt-4 h-3 w-3/4 rounded" />
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
        <div className="flex -space-x-2">
          <Block className="h-7 w-7 rounded-full" />
          <Block className="h-7 w-7 rounded-full" />
          <Block className="h-7 w-7 rounded-full" />
        </div>
        <Block className="h-3 w-16 rounded" />
      </div>
    </div>
  );
}

function Block({ className }: { className: string }) {
  return (
    <span
      className={cn(
        "block animate-pulse bg-slate-200 dark:bg-slate-700",
        className,
      )}
    />
  );
}
