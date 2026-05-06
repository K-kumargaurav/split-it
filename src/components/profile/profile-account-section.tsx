import { ChevronRight, Download, Trash2 } from "lucide-react";

import { PremiumCard } from "@/components/ui/premium-card";

export function ProfileAccountSection() {
  return (
    <PremiumCard className="overflow-hidden !p-0">
      <h2 className="px-6 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-widest text-[#8B93A7]">
        Account
      </h2>
      <div className="divide-y divide-white/[0.04]">
        <button
          type="button"
          className="flex w-full items-center justify-between px-6 py-4 text-sm text-[#F5F7FA] transition-colors hover:bg-white/[0.02]"
        >
          <span>Change Password</span>
          <ChevronRight size={16} className="text-[#8B93A7]" />
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-between px-6 py-4 text-sm text-[#F5F7FA] transition-colors hover:bg-white/[0.02]"
        >
          <span className="flex items-center gap-2">
            <Download size={15} className="text-[#8B93A7]" />
            Export my data
          </span>
          <ChevronRight size={16} className="text-[#8B93A7]" />
        </button>
        <button
          type="button"
          className="flex w-full items-center px-6 py-4 text-sm text-[#FF4757] transition-colors hover:bg-[rgba(255,71,87,0.04)]"
        >
          <Trash2 size={15} className="mr-2 flex-shrink-0" />
          Delete Account
        </button>
      </div>
    </PremiumCard>
  );
}
