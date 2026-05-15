import { GroupCardSkeleton } from "@/components/ui/skeleton";

export default function GroupsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="h-5 w-16 animate-pulse rounded bg-white/5" />
          <div className="h-3.5 w-20 animate-pulse rounded bg-white/5" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-2xl bg-white/5" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <GroupCardSkeleton />
        <GroupCardSkeleton />
        <GroupCardSkeleton />
        <GroupCardSkeleton />
      </div>
    </div>
  );
}
