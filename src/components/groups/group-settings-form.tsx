"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";

// Mirror of `COLOR_PRESETS` in create-group-form. Six on-brand presets keep
// monogram tiles legible across the dashboard. Free-form hex would let users
// pick colours that fail the contrast check on the white avatar.
const COLOR_PRESETS = [
  { hex: "#6366F1", label: "Indigo" },
  { hex: "#10B981", label: "Emerald" },
  { hex: "#F59E0B", label: "Amber" },
  { hex: "#EC4899", label: "Pink" },
  { hex: "#0EA5E9", label: "Sky" },
  { hex: "#8B5CF6", label: "Violet" },
] as const;

interface GroupSettingsFormProps {
  group: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    icon: string | null;
    balanceMode: "DIRECT" | "SIMPLIFIED";
  };
  isOwner: boolean;
}

export function GroupSettingsForm({ group, isOwner }: GroupSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [icon, setIcon] = useState(group.icon ?? "");
  const [color, setColor] = useState(group.color ?? COLOR_PRESETS[0].hex);
  const [balanceMode, setBalanceMode] = useState(group.balanceMode);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError("Group name is required.");
        setSubmitting(false);
        return;
      }
      const body: Record<string, unknown> = {
        name: trimmedName,
        description: description.trim() ? description.trim() : null,
        icon: icon.trim() ? icon.trim() : null,
        color,
      };
      if (isOwner) body.balanceMode = balanceMode;

      const response = await fetch(`/api/v1/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(json?.error?.message ?? "Couldn't save changes.");
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    } catch {
      setError("Couldn't save changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div>
        <label htmlFor="g-name" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Group name
        </label>
        <input
          id="g-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          className="mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="g-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Description
        </label>
        <textarea
          id="g-desc"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1.5 block w-full resize-y rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="g-icon" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Icon <span className="text-slate-400">(emoji or single character)</span>
        </label>
        <input
          id="g-icon"
          type="text"
          maxLength={8}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="mt-1.5 block w-32 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200">Color</legend>
        <div className="mt-2 flex flex-wrap gap-2.5">
          {COLOR_PRESETS.map((preset) => {
            const active = color === preset.hex;
            return (
              <button
                key={preset.hex}
                type="button"
                onClick={() => setColor(preset.hex)}
                aria-label={preset.label}
                aria-pressed={active}
                className={cn(
                  "h-9 w-9 rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                  active ? "scale-110 border-slate-900" : "border-transparent hover:scale-105",
                )}
                style={{ backgroundColor: preset.hex }}
              />
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200">Balance mode</legend>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {isOwner
            ? "Switch how balances are displayed across the group."
            : "Only the group owner can change the balance mode."}
        </p>
        <div role="radiogroup" className="mt-2 grid gap-2 sm:grid-cols-2">
          <ModeOption
            label="Direct"
            description="Show every pairwise debt as-is."
            active={balanceMode === "DIRECT"}
            disabled={!isOwner}
            onClick={() => setBalanceMode("DIRECT")}
          />
          <ModeOption
            label="Simplified"
            description="Combine debts into the fewest payments."
            active={balanceMode === "SIMPLIFIED"}
            disabled={!isOwner}
            onClick={() => setBalanceMode("SIMPLIFIED")}
          />
        </div>
      </fieldset>

      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
        >
          {error}
        </div>
      ) : null}

      {savedAt ? (
        <p className="text-xs text-emerald-700" aria-live="polite">
          Changes saved.
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
            "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function ModeOption({
  label,
  description,
  active,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
        active
          ? "border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
      <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</span>
    </button>
  );
}
