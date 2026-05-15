import { MemberListSkeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="h-7 w-24 animate-pulse rounded bg-white/5" />
          <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
        </div>
      </header>
      <div className="rounded-2xl border border-white/[0.06] bg-[#161B22] p-6 sm:p-8">
        <MemberListSkeleton />
      </div>
    </div>
  );
}
