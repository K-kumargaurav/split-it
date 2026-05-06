"use client";

import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

interface EmptyExpensesProps {
  groupId: string;
}

export function EmptyExpenses({ groupId }: EmptyExpensesProps) {
  const router = useRouter();

  return (
    <EmptyState
      icon={Receipt}
      title="No expenses yet"
      description="Add the first expense and SplitEasy handles the math"
      action={{
        label: "Add expense",
        onClick: () => router.push(`/groups/${groupId}/expenses/new`),
      }}
    />
  );
}
