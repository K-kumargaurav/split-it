"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { TabNav, type TabItem } from "@/components/ui/tab-nav";

interface Tab extends TabItem {
  href: string;
}

interface GroupTabNavClientProps {
  tabs: Tab[];
}

function GroupTabNavInner({ tabs }: GroupTabNavClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function resolveActive(): string {
    // Query-param tabs take priority (more specific match)
    for (const tab of tabs) {
      if (!tab.href.includes("?")) continue;
      const [tabPath, tabQuery] = tab.href.split("?");
      const tabParams = new URLSearchParams(tabQuery);
      const allMatch = Array.from(tabParams.entries()).every(
        ([k, v]) => searchParams.get(k) === v,
      );
      if (pathname === tabPath && allMatch) return tab.id;
    }

    // Path-only tabs — longest href wins (most specific)
    const pathOnly = tabs
      .filter((t) => !t.href.includes("?"))
      .sort((a, b) => b.href.length - a.href.length);
    for (const tab of pathOnly) {
      if (pathname === tab.href || pathname.startsWith(tab.href + "/")) {
        return tab.id;
      }
    }

    return "";
  }

  const activeTab = resolveActive();

  function handleChange(id: string) {
    const tab = tabs.find((t) => t.id === id);
    if (tab) router.push(tab.href);
  }

  return <TabNav tabs={tabs} activeTab={activeTab} onChange={handleChange} />;
}

export function GroupTabNavClient({ tabs }: GroupTabNavClientProps) {
  return (
    <Suspense fallback={null}>
      <GroupTabNavInner tabs={tabs} />
    </Suspense>
  );
}
