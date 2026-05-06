"use client";

import Link from "next/link";
import { Users } from "lucide-react";

import { GroupCard, type GroupCardData } from "@/components/dashboard/group-card";
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

function EmptyGroups() {
  return (
    <section
      aria-labelledby="no-groups-heading"
      className="flex flex-col items-center rounded-3xl border border-white/5 bg-[#161B22] px-6 py-12 text-center shadow-card"
    >
      <Users
        size={40}
        className="text-[#8B93A7]"
        aria-hidden="true"
      />
      <h2
        id="no-groups-heading"
        className="mt-4 text-base font-medium text-[#F5F7FA]"
      >
        No groups yet
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-[#8B93A7]">
        Start splitting expenses with friends or flatmates
      </p>
      <Link
        href="/groups/new"
        className="mt-6 inline-flex h-[52px] items-center justify-center rounded-2xl bg-[#00C896] px-8 font-semibold text-[#0E1116] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116]"
      >
        Create your first group
      </Link>
    </section>
  );
}
