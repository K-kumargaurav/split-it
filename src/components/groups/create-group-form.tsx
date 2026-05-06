"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toast } from "sonner";

import { cn } from "@/lib/cn";

// Six on-brand presets — keeps groups visually distinct on the dashboard
// without giving users a colour wheel that produces unreadable monograms.
const COLOR_PRESETS = [
  { hex: "#6366F1", label: "Indigo" },
  { hex: "#10B981", label: "Emerald" },
  { hex: "#F59E0B", label: "Amber" },
  { hex: "#EC4899", label: "Pink" },
  { hex: "#0EA5E9", label: "Sky" },
  { hex: "#8B5CF6", label: "Violet" },
] as const;

// Mirrors the server schema in `@/lib/validations/groups`. The server is the
// source of truth; this client copy keeps form-level UX (inline errors)
// snappy without a round-trip.
const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Group name is required." })
    .max(80, { message: "Group name is too long." }),
  description: z
    .string()
    .trim()
    .max(500, { message: "Description is too long." })
    .optional(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, { message: "Currency must be a 3-letter code." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  balanceMode: z.enum(["DIRECT", "SIMPLIFIED"]),
});

type FormValues = z.infer<typeof formSchema>;

interface CreatedGroupResponse {
  group: { id: string };
}

export function CreateGroupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      description: "",
      currency: "INR",
      color: COLOR_PRESETS[0].hex,
      balanceMode: "DIRECT",
    },
  });

  const selectedColor = watch("color");
  const selectedMode = watch("balanceMode");

  async function onSubmit(values: FormValues): Promise<void> {
    setServerError(null);
    try {
      const response = await fetch("/api/v1/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setServerError(body?.error?.message ?? "Couldn't create the group. Please try again.");
        return;
      }
      const body = (await response.json()) as CreatedGroupResponse;
      toast.success("Group created");
      // Navigate via push so back button returns to /groups/new — keeps the
      // mental model that "creating a group" is a discrete action the user
      // can undo with a back-press if they realise they typed the wrong name.
      router.push(`/groups/${body.group.id}`);
      router.refresh();
    } catch {
      setServerError("Couldn't create the group. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div>
        <label htmlFor="group-name" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Group name
        </label>
        <input
          {...register("name")}
          id="group-name"
          type="text"
          maxLength={80}
          autoComplete="off"
          autoFocus
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "group-name-error" : undefined}
          placeholder="Goa trip · Roomies · Office lunch"
          className={cn(
            "mt-1.5 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition",
            "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
            errors.name && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
          )}
        />
        {errors.name ? (
          <p id="group-name-error" className="mt-1.5 text-xs text-rose-600">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="group-description" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Description <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          {...register("description")}
          id="group-description"
          rows={3}
          maxLength={500}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "group-description-error" : undefined}
          placeholder="What's this group for?"
          className={cn(
            "mt-1.5 block w-full resize-y rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition",
            "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
            errors.description && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
          )}
        />
        {errors.description ? (
          <p id="group-description-error" className="mt-1.5 text-xs text-rose-600">
            {errors.description.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="group-currency" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Currency
        </label>
        <input
          {...register("currency")}
          id="group-currency"
          type="text"
          maxLength={3}
          spellCheck={false}
          aria-invalid={Boolean(errors.currency)}
          aria-describedby="group-currency-help"
          className={cn(
            "mt-1.5 block w-32 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm uppercase tracking-wider text-slate-900 dark:text-white shadow-sm transition",
            "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
            errors.currency && "border-rose-300 focus:border-rose-400 focus:ring-rose-400",
          )}
        />
        <p id="group-currency-help" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Locked once the first expense is added.
        </p>
        {errors.currency ? (
          <p className="mt-1 text-xs text-rose-600">{errors.currency.message}</p>
        ) : null}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200">Color</legend>
        <div className="mt-2 flex flex-wrap gap-2.5">
          {COLOR_PRESETS.map((preset) => {
            const active = selectedColor === preset.hex;
            return (
              <button
                key={preset.hex}
                type="button"
                onClick={() =>
                  setValue("color", preset.hex, { shouldDirty: true, shouldValidate: true })
                }
                aria-label={preset.label}
                aria-pressed={active}
                className={cn(
                  "h-9 w-9 rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                  active ? "border-slate-900 scale-110" : "border-transparent hover:scale-105",
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
          You can change this later — it only affects how balances are displayed.
        </p>
        <div role="radiogroup" className="mt-2 grid gap-2 sm:grid-cols-2">
          <ModeOption
            label="Direct"
            description="Show every pairwise debt as-is."
            active={selectedMode === "DIRECT"}
            onClick={() =>
              setValue("balanceMode", "DIRECT", { shouldDirty: true, shouldValidate: true })
            }
          />
          <ModeOption
            label="Simplified"
            description="Combine debts into the fewest payments."
            active={selectedMode === "SIMPLIFIED"}
            onClick={() =>
              setValue("balanceMode", "SIMPLIFIED", { shouldDirty: true, shouldValidate: true })
            }
          />
        </div>
      </fieldset>

      {serverError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
        >
          {serverError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
            "hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {isSubmitting ? "Creating…" : "Create group"}
        </button>
      </div>
    </form>
  );
}

function ModeOption({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex flex-col rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
        active
          ? "border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600",
      )}
    >
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
      <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</span>
    </button>
  );
}
