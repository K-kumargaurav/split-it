import { AuditSkeleton } from "@/components/ui/skeleton";

export default function AuditLoading() {
  return (
    <div>
      <header className="mb-6">
        <div className="h-7 w-24 animate-pulse rounded bg-white/5" />
      </header>
      <AuditSkeleton />
    </div>
  );
}
