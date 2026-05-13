"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/cn";
import { PremiumInput } from "@/components/ui/premium-input";

const ICONS = ["🏠", "✈️", "🍕", "🎮", "💪", "🎉", "🌴", "💼"] as const;
const COLORS = ["#6366F1", "#00C896", "#F59E0B", "#EC4899", "#06B6D4", "#8B5CF6"] as const;

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
  const [icon, setIcon] = useState(group.icon ?? ICONS[0]);
  const [color, setColor] = useState(group.color ?? COLORS[0]);
  const [balanceMode, setBalanceMode] = useState(group.balanceMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaved(false);
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
        icon: icon || null,
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
      setSaved(true);
      router.refresh();
    } catch {
      setError("Couldn't save changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Group name */}
      <PremiumInput
        id="g-name"
        label="Group name"
        value={name}
        onChange={(e) => { setName(e.target.value); setSaved(false); }}
        maxLength={80}
        autoComplete="off"
        placeholder="Goa trip · Roomies · Office lunch"
      />

      {/* Description */}
      <div>
        <label htmlFor="g-desc" className="mb-1.5 block text-[13px] text-text-secondary">
          Description <span className="text-[#8B93A7]">(optional)</span>
        </label>
        <textarea
          id="g-desc"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
          placeholder="What's this group for?"
          className={cn(
            "block w-full resize-none rounded-2xl border bg-card px-4 py-3 text-sm text-text-primary transition",
            "placeholder:text-text-secondary focus:outline-none focus:ring-2",
            "border-white/[0.06] focus:border-accent focus:ring-accent/10",
          )}
        />
      </div>

      {/* Icon picker */}
      <fieldset>
        <legend className="mb-2 text-[13px] text-text-secondary">Icon</legend>
        <div className="flex flex-wrap gap-2">
          {ICONS.map((emoji) => {
            const active = icon === emoji;
            return (
              <motion.button
                key={emoji}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => { setIcon(emoji); setSaved(false); }}
                aria-pressed={active}
                aria-label={`Select icon ${emoji}`}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full border text-xl transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  active
                    ? "border-accent bg-accent/10"
                    : "border-white/[0.06] bg-white/[0.04] hover:border-white/[0.12]",
                )}
              >
                {emoji}
              </motion.button>
            );
          })}
        </div>
      </fieldset>

      {/* Color picker */}
      <fieldset>
        <legend className="mb-2 text-[13px] text-text-secondary">Color</legend>
        <div className="flex flex-wrap gap-3">
          {COLORS.map((hex) => {
            const active = color === hex;
            return (
              <motion.button
                key={hex}
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => { setColor(hex); setSaved(false); }}
                aria-label={`Select color ${hex}`}
                aria-pressed={active}
                className={cn(
                  "h-8 w-8 rounded-full transition focus-visible:outline-none",
                  active && "ring-2 ring-white ring-offset-2 ring-offset-[#161B22]",
                )}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </fieldset>

      {/* Balance mode */}
      <div>
        <p className="text-[13px] text-text-secondary mb-1">
          Balance mode
          {!isOwner && (
            <span className="ml-1 text-[11px] text-text-secondary/60">
              — only the group owner can change this
            </span>
          )}
        </p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Balance mode">
          {(["DIRECT", "SIMPLIFIED"] as const).map((mode) => {
            const active = balanceMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!isOwner}
                onClick={() => { setBalanceMode(mode); setSaved(false); }}
                className={cn(
                  "flex flex-col rounded-2xl border px-4 py-3 text-left transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  active
                    ? "border-accent bg-accent/5"
                    : "border-white/[0.06] bg-transparent hover:border-white/[0.12]",
                  !isOwner && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="text-sm font-medium text-text-primary">
                  {mode === "DIRECT" ? "Direct" : "Simplified"}
                </span>
                <span className="mt-0.5 text-[12px] text-text-secondary">
                  {mode === "DIRECT"
                    ? "Show every pairwise debt as-is"
                    : "Minimize number of payments"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error / success */}
      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
        >
          {error}
        </div>
      ) : null}
      {saved ? (
        <p className="text-[13px] text-accent" aria-live="polite">
          Changes saved.
        </p>
      ) : null}

      {/* Save button */}
      <motion.button
        type="submit"
        disabled={submitting}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex h-[52px] w-full items-center justify-center rounded-2xl bg-accent font-semibold text-bg transition-opacity",
          "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {submitting ? "Saving…" : "Save changes"}
      </motion.button>
    </form>
  );
}
