"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export function EmptyGroups() {
  const router = useRouter();

  return (
    <EmptyState
      icon={Users}
      title="No groups yet"
      description="Split expenses with friends, flatmates, or anyone"
      action={{ label: "Create your first group", onClick: () => router.push("/groups/new") }}
    />
  );
}
