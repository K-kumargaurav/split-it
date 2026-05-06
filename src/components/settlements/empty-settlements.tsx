"use client";

import { CheckCircle } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export function EmptySettlements() {
  return (
    <EmptyState
      icon={CheckCircle}
      title="All settled up"
      description="No pending payments in this group"
    />
  );
}
