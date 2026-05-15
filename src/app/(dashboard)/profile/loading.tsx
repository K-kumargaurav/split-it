import { ProfileSkeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div>
      <header className="mb-8">
        <div className="h-7 w-20 animate-pulse rounded bg-white/5" />
      </header>
      <ProfileSkeleton />
    </div>
  );
}
