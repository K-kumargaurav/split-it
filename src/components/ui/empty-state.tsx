"use client";

import { type LucideIcon } from "lucide-react";

import { FadeIn } from "@/components/ui/motion";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <FadeIn>
      <div className="flex flex-col items-center px-6 py-12">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04]"
        >
          <Icon size={28} className="text-[#8B93A7]" />
        </span>
        <p className="mt-4 text-base font-medium text-[#F5F7FA]">{title}</p>
        <p className="mt-1.5 max-w-xs text-center text-sm text-[#8B93A7]">{description}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-5 rounded-2xl border border-white/[0.08] bg-transparent px-5 py-2.5 text-sm font-medium text-[#F5F7FA] transition-colors hover:border-white/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896]"
          >
            {action.label}
          </button>
        )}
      </div>
    </FadeIn>
  );
}
