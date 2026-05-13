"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/cn";

interface NotifRow {
  id: string;
  label: string;
  description: string;
}

const ROWS: NotifRow[] = [
  { id: "expenseAdded",        label: "Expense added",        description: "When someone adds an expense" },
  { id: "settlementPending",   label: "Settlement pending",   description: "When someone marks a payment" },
  { id: "settlementConfirmed", label: "Settlement confirmed", description: "When payment is confirmed" },
  { id: "editProposals",       label: "Edit proposals",       description: "When someone proposes an edit" },
  { id: "pushNotifications",   label: "Push notifications",   description: "Browser push notifications" },
  { id: "whatsappReminders",   label: "WhatsApp reminders",   description: "Settlement reminders via WhatsApp (opt-in)" },
];

const DEFAULT_ENABLED: Record<string, boolean> = Object.fromEntries(
  ROWS.map((r) => [r.id, r.id !== "whatsappReminders"]),
);

export function NotificationSettings() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(DEFAULT_ENABLED);

  function toggle(id: string) {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {ROWS.map((row) => (
        <ToggleRow
          key={row.id}
          label={row.label}
          description={row.description}
          enabled={enabled[row.id] ?? false}
          onToggle={() => toggle(row.id)}
        />
      ))}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function ToggleRow({ label, description, enabled, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-text-primary">{label}</p>
        <p className="mt-0.5 text-[12px] text-text-secondary">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          enabled ? "bg-[#00C896]" : "bg-white/10",
        )}
      >
        <motion.span
          className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm"
          animate={{ x: enabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}
