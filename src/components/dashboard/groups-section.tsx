"use client";

import Link from "next/link";

import { GroupCard, type GroupCardData } from "@/components/dashboard/group-card";
import { EmptyGroups } from "@/components/dashboard/empty-groups";
import { ScaleIn, StaggerChildren } from "@/components/ui/motion";

interface GroupsSectionProps {
  groups: GroupCardData[];
}

export function GroupsSection({ groups }: GroupsSectionProps) {
  if (groups.length === 0) {
    return <EmptyGroups />;
  }

  return (
    <section aria-labelledby="groups-heading">
      <div className="mb-5 flex items-center justify-between">
        <h2
          id="groups-heading"
          className="text-[18px] font-semibold text-[#F5F7FA]"
        >
          Your Groups
        </h2>
        {groups.length > 4 && (
          <Link
            href="/groups"
            className="text-sm font-medium text-[#00C896] transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116]"
          >
            See all
          </Link>
        )}
      </div>

      <StaggerChildren
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        staggerDelay={0.06}
      >
        {groups.map((group) => (
          <ScaleIn key={group.id}>
            <GroupCard {...group} />
          </ScaleIn>
        ))}
      </StaggerChildren>
    </section>
  );
}
