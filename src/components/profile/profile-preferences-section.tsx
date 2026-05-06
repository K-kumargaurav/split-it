"use client";

import { useState } from "react";

import { PremiumCard } from "@/components/ui/premium-card";
import { PremiumSelect } from "@/components/ui/premium-select";
import { ToggleSwitch } from "@/components/ui/toggle-switch";

interface NotifPref {
  id: string;
  label: string;
  description: string;
}

const NOTIF_PREFS: NotifPref[] = [
  {
    id: "expenseAdded",
    label: "New expenses",
    description: "Get notified when someone adds an expense to your group",
  },
  {
    id: "settlementReminders",
    label: "Settlement reminders",
    description: "Reminders to settle up pending payments",
  },
  {
    id: "groupActivity",
    label: "Group activity",
    description: "Comments, edits, and member changes",
  },
];

interface ProfilePreferencesSectionProps {
  initialCurrency: string;
  initialLocale: string;
}

export function ProfilePreferencesSection({
  initialCurrency,
  initialLocale,
}: ProfilePreferencesSectionProps) {
  const [currency, setCurrency] = useState(initialCurrency);
  const [language, setLanguage] = useState(initialLocale);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    expenseAdded: true,
    settlementReminders: true,
    groupActivity: false,
  });

  return (
    <PremiumCard className="p-6">
      <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-[#8B93A7]">
        Preferences
      </h2>
      <div className="space-y-4">
        <PremiumSelect
          label="Currency"
          id="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          <option value="INR">INR — Indian Rupee</option>
          <option value="USD">USD — US Dollar</option>
          <option value="EUR">EUR — Euro</option>
          <option value="GBP">GBP — British Pound</option>
        </PremiumSelect>

        <PremiumSelect
          label="Language"
          id="language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="en-IN">English</option>
          <option value="hi-IN">हिन्दी</option>
        </PremiumSelect>

        <div>
          <p className="mb-3 text-[13px] text-[#8B93A7]">Notification preferences</p>
          <div className="divide-y divide-white/[0.04]">
            {NOTIF_PREFS.map((pref) => (
              <div
                key={pref.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#F5F7FA]">{pref.label}</p>
                  <p className="mt-0.5 text-[12px] text-[#8B93A7]">{pref.description}</p>
                </div>
                <ToggleSwitch
                  checked={notifPrefs[pref.id] ?? false}
                  onChange={(v) =>
                    setNotifPrefs((prev) => ({ ...prev, [pref.id]: v }))
                  }
                  aria-label={pref.label}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PremiumCard>
  );
}
