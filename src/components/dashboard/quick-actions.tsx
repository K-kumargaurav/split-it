"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

import {
  GroupSelectorModal,
  type GroupOption,
} from "@/components/dashboard/group-selector-modal";

interface QuickActionsProps {
  groups: GroupOption[];
}

export function QuickActions({ groups }: QuickActionsProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  function handleAddExpense() {
    if (groups.length === 0) {
      toast.info("Create a group first");
      return;
    }
    if (groups.length === 1) {
      router.push(`/groups/${groups[0]!.id}/expenses/new`);
      return;
    }
    setModalOpen(true);
  }

  return (
    <>
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="sr-only">
          Quick actions
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Add Expense */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={handleAddExpense}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#00C896] px-6 font-semibold text-[#0E1116] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116]"
            aria-label="Add expense"
          >
            <Plus size={18} aria-hidden="true" />
            Add Expense
          </motion.button>

          {/* New Group */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/groups/new")}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-6 font-medium text-[#F5F7FA] transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1116]"
            aria-label="Create a new group"
          >
            <Users size={18} aria-hidden="true" />
            New Group
          </motion.button>
        </div>
      </section>

      <GroupSelectorModal
        isOpen={modalOpen}
        groups={groups}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
