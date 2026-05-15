import { ExpenseCardSkeleton } from "@/components/ui/skeleton";

export default function ExpenseDetailLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-40 animate-pulse rounded bg-white/5" />
      <ExpenseCardSkeleton />
      <ExpenseCardSkeleton />
    </div>
  );
}
