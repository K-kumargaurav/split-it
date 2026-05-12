import { ExpenseCardSkeleton } from "@/components/ui/skeleton";

export default function GroupLoading() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <ExpenseCardSkeleton />
      <ExpenseCardSkeleton />
      <ExpenseCardSkeleton />
      <ExpenseCardSkeleton />
    </div>
  );
}
