"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";

export interface GroupOption {
  id: string;
  name: string;
  icon: string;
  memberCount: number;
}

interface GroupSelectorModalProps {
  isOpen: boolean;
  groups: GroupOption[];
  onClose: () => void;
}

export function GroupSelectorModal({ isOpen, groups, onClose }: GroupSelectorModalProps) {
  const router = useRouter();

  function handleSelect(groupId: string) {
    router.push(`/groups/${groupId}/expenses/new`);
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-selector-title"
        >
          <m.div
            className="relative w-full max-w-sm rounded-3xl border border-white/[0.08] bg-[#161B22] p-6"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1 text-white/40 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              aria-label="Close"
            >
              <X size={18} aria-hidden="true" />
            </button>

            <h2
              id="group-selector-title"
              className="mb-4 text-lg font-semibold text-[#F5F7FA]"
            >
              Which group?
            </h2>

            <ul className="space-y-1" role="list">
              {groups.map((group) => (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(group.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg"
                      aria-hidden="true"
                    >
                      {group.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#F5F7FA]">
                        {group.name}
                      </span>
                      <span className="block text-xs text-white/40">
                        {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
