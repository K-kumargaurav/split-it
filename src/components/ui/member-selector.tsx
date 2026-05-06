"use client";

import { motion } from "framer-motion";

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
            <motion.button
              key={member.id}
              type="button"
              onClick={() => onToggle(member.id)}
              aria-pressed={isSelected}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200"
              style={{
                background: isSelected
                  ? "rgba(0,200,150,0.1)"
                  : "rgba(255,255,255,0.03)",
                borderColor: isSelected ? "#00C896" : "rgba(255,255,255,0.06)",
                color: isSelected ? "#00C896" : "#8B93A7",
              }}
            >
              <span
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  background: isSelected
                    ? "rgba(0,200,150,0.2)"
                    : "rgba(255,255,255,0.06)",
                  color: isSelected ? "#00C896" : "#8B93A7",
                }}
              >
                {initials}
              </span>
              <span className="max-w-[100px] truncate">{member.displayName}</span>
              {member.isGhost ? (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                  style={{
                    background: "rgba(255,176,32,0.15)",
                    color: "#FFB020",
                  }}
                >
                  Guest
                </span>
              ) : null}
            </motion.button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-1.5 text-[12px] text-error">{error}</p>
      ) : null}
    </div>
  );
}
