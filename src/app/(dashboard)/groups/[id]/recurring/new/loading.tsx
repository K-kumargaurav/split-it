import { FormSkeleton } from "@/components/ui/skeleton";

export default function NewRecurringLoading() {
  return (
    <div>
      <header className="mb-6">
        <div className="h-7 w-40 animate-pulse rounded bg-white/5" />
      </header>
      <FormSkeleton />
    </div>
  );
}
