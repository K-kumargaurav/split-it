import { SettingsSkeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 space-y-2">
        <div className="h-7 w-20 animate-pulse rounded bg-white/5" />
        <div className="h-4 w-64 animate-pulse rounded bg-white/5" />
      </div>
      <SettingsSkeleton />
    </div>
  );
}
