import { BalanceHeroSkeleton, GroupCardSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6 sm:pb-10 sm:pt-10 lg:py-12">
      <div className="space-y-8">
        <BalanceHeroSkeleton />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GroupCardSkeleton />
          <GroupCardSkeleton />
          <GroupCardSkeleton />
        </div>
      </div>
    </main>
  );
}
