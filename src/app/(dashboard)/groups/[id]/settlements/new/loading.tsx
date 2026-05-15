import { FormSkeleton } from "@/components/ui/skeleton";

export default function NewSettlementLoading() {
  return (
    <div>
      <header className="mb-6">
        <div className="h-7 w-36 animate-pulse rounded bg-white/5" />
      </header>
      <FormSkeleton />
    </div>
  );
}
