import { FormSkeleton } from "@/components/ui/skeleton";

export default function GroupSettingsLoading() {
  return (
    <div>
      <header className="mb-6">
        <div className="h-7 w-24 animate-pulse rounded bg-white/5" />
      </header>
      <div className="rounded-2xl border border-white/[0.06] bg-[#161B22] p-6 sm:p-8">
        <FormSkeleton />
      </div>
    </div>
  );
}
