"use client";

import { m, LayoutGroup } from "framer-motion";

export interface TabItem {
  id: string;
  label: string;
}

interface TabNavProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function TabNav({ tabs, activeTab, onChange }: TabNavProps) {
  return (
    <div className="-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <LayoutGroup id="tab-nav">
        <div
          role="tablist"
          aria-label="Group sections"
          className="inline-flex sm:flex sm:min-w-full rounded-2xl bg-[#161B22] p-1"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(tab.id)}
                className="relative sm:flex-1 flex-shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896]"
              >
                {isActive && (
                  <m.span
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl bg-[#0E1116]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={
                    isActive
                      ? "relative z-10 font-medium text-[#F5F7FA]"
                      : "relative z-10 text-[#8B93A7]"
                  }
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
