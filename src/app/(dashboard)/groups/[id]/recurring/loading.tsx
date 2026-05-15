import { RecurringSkeleton } from "@/components/ui/skeleton";

export default function RecurringLoading() {
  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="h-7 w-24 animate-pulse rounded bg-white/5" />
      </header>
      <RecurringSkeleton />
    </div>
  );
}
