"use client";

import { m } from "framer-motion";

import { cn } from "@/lib/cn";

export interface SelectorMember {
  id: string;
  displayName: string;
  handle?: string;
  isGhost?: boolean;
}

interface MemberSelectorProps {
  members: SelectorMember[];
  selected: string | string[];
  onToggle: (id: string) => void;
  mode?: "single" | "multi";
  error?: string;
}

export function MemberSelector({
  members,
  selected,
  onToggle,
  error,
}: MemberSelectorProps) {
  const selectedSet = new Set(
    Array.isArray(selected) ? selected : selected ? [selected] : [],
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {members.map((member) => {
          const isSelected = selectedSet.has(member.id);
          const initials = member.displayName
            .split(" ")
            .map((n) => n[0] ?? "")
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <m.button
              key={member.id}
              type="button"
              onClick={() => onToggle(member.id)}
              aria-pressed={isSelected}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                isSelected
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-white/[0.06] bg-white/[0.03] text-text-secondary",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-semibold",
                  isSelected
                    ? "bg-accent/20 text-accent"
                    : "bg-white/[0.06] text-text-secondary",
                )}
              >
                {initials}
              </span>
              <span className="max-w-[100px] truncate">{member.displayName}</span>
              {member.isGhost ? (
                <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
                  Guest
                </span>
              ) : null}
            </m.button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-1.5 text-[12px] text-error">{error}</p>
      ) : null}
    </div>
  );
}
