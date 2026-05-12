"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { PremiumInput } from "@/components/ui/premium-input";
import { cn } from "@/lib/cn";

const ICONS = ["🏠", "✈️", "🍕", "🎮", "💪", "🎉", "🌴", "💼"] as const;
const COLORS = ["#6366F1", "#00C896", "#F59E0B", "#EC4899", "#06B6D4", "#8B5CF6"] as const;

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
  currency: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().min(1).max(8).optional(),
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
      color: COLORS[0],
      icon: ICONS[0],
      balanceMode: "DIRECT",
    },
  });

  const selectedColor = watch("color");
  const selectedMode = watch("balanceMode");
  const selectedIcon = watch("icon") ?? ICONS[0];

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
      router.push(`/groups/${body.group.id}`);
      router.refresh();
    } catch {
      setServerError("Couldn't create the group. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Group name */}
      <PremiumInput
        {...register("name")}
        label="Group name"
        placeholder="Goa trip · Roomies · Office lunch"
        maxLength={80}
        autoComplete="off"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        error={errors.name?.message}
      />

      {/* Description */}
      <div>
        <label htmlFor="group-description" className="mb-1.5 block text-[13px] text-text-secondary">
          Description{" "}
          <span className="text-[#8B93A7]">(optional)</span>
        </label>
        <textarea
          {...register("description")}
          id="group-description"
          rows={3}
          maxLength={500}
          placeholder="What's this group for? (optional)"
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "desc-error" : undefined}
          className={cn(
            "block w-full resize-none rounded-2xl border bg-card px-4 py-3 text-sm text-text-primary transition",
            "placeholder:text-text-secondary focus:outline-none focus:ring-2",
            errors.description
              ? "border-error focus:border-error focus:ring-error/10"
              : "border-white/[0.06] focus:border-accent focus:ring-accent/10",
          )}
        />
        {errors.description ? (
          <p id="desc-error" className="mt-1.5 text-[12px] text-error">
            {errors.description.message}
          </p>
        ) : null}
      </div>

      {/* Icon picker */}
      <fieldset>
        <legend className="mb-2 text-[13px] text-[#8B93A7]">Icon</legend>
        <div className="flex flex-wrap gap-2">
          {ICONS.map((emoji) => {
            const active = selectedIcon === emoji;
            return (
              <motion.button
                key={emoji}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setValue("icon", emoji, { shouldDirty: true })}
                aria-pressed={active}
                aria-label={`Select icon ${emoji}`}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full border text-xl transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  active
                    ? "border-[#00C896] bg-[rgba(0,200,150,0.1)]"
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
        <legend className="mb-2 text-[13px] text-[#8B93A7]">Color</legend>
        <div className="flex flex-wrap gap-3">
          {COLORS.map((hex) => {
            const active = selectedColor === hex;
            return (
              <motion.button
                key={hex}
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setValue("color", hex, { shouldDirty: true, shouldValidate: true })}
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
        <p className="text-sm font-medium text-[#F5F7FA]">Balance mode</p>
        <p className="mb-2 text-[12px] text-[#8B93A7]">You can change this later</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Balance mode">
          {(["DIRECT", "SIMPLIFIED"] as const).map((mode) => {
            const active = selectedMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() =>
                  setValue("balanceMode", mode, { shouldDirty: true, shouldValidate: true })
                }
                className={cn(
                  "flex flex-col rounded-2xl border px-4 py-3 text-left transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  active
                    ? "border-[#00C896] bg-[rgba(0,200,150,0.05)]"
                    : "border-white/[0.06] bg-transparent hover:border-white/[0.12]",
                )}
              >
                <span className="text-sm font-medium text-[#F5F7FA]">
                  {mode === "DIRECT" ? "Direct" : "Simplified"}
                </span>
                <span className="mt-0.5 text-[12px] text-[#8B93A7]">
                  {mode === "DIRECT"
                    ? "Show every pairwise debt as-is"
                    : "Minimize number of payments"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Currency (locked) */}
      <div>
        <p className="mb-2 text-[13px] text-[#8B93A7]">Currency</p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-white/[0.04] px-4 py-2 text-sm font-medium text-[#F5F7FA]">
            INR ₹
          </span>
          <p className="text-[11px] text-[#8B93A7]">Locked once first expense is added</p>
        </div>
      </div>

      {/* Server error */}
      {serverError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
        >
          {serverError}
        </div>
      ) : null}

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={isSubmitting}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#00C896] px-6 font-semibold text-[#0E1116] transition-opacity",
          "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161B22]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isSubmitting ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Creating…
          </>
        ) : (
          <>
            <span aria-hidden="true">{selectedIcon}</span>
            Create Group
          </>
        )}
      </motion.button>
    </form>
  );
}
