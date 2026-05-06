"use client";

import { Bell } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export function EmptyNotifications() {
  return (
    <EmptyState
      icon={Bell}
      title="You're all caught up"
      description="No new notifications"
    />
  );
}
