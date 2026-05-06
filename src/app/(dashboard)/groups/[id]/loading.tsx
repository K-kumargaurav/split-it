import { ExpenseCardSkeleton } from "@/components/ui/skeleton";

function HeaderSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-3xl border border-white/5 bg-[#161B22] p-6 shadow-card"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.06)_50%,rgba(255,255,255,0.03)_100%)] [background-size:200%_100%] animate-shimmer" />
        <div className="space-y-2">
          <div className="h-5 w-40 rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.06)_50%,rgba(255,255,255,0.03)_100%)] [background-size:200%_100%] animate-shimmer" />
          <div className="h-3 w-24 rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.06)_50%,rgba(255,255,255,0.03)_100%)] [background-size:200%_100%] animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function GroupLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6 sm:pb-10 sm:pt-10 lg:py-12">
      <div className="space-y-6">
        <HeaderSkeleton />
        <div className="space-y-2">
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
          <ExpenseCardSkeleton />
        </div>
      </div>
    </main>
  );
}
