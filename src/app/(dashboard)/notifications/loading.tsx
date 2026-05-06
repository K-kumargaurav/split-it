import { NotificationSkeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6 sm:pb-10 sm:pt-10 lg:py-12">
      <div className="flex flex-col gap-1">
        <NotificationSkeleton />
        <NotificationSkeleton />
        <NotificationSkeleton />
        <NotificationSkeleton />
        <NotificationSkeleton />
        <NotificationSkeleton />
      </div>
    </main>
  );
}
