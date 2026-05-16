"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { cn } from "@/lib/cn";
import { formatPaise, rupeesToPaise } from "@/lib/format";
import { PremiumInput } from "@/components/ui/premium-input";

// Focused edit form for proposable fields only (title, amount, date, notes).
// For the expense creator, changes are applied immediately. For others, a
// 48h voting proposal is created. Both paths hit the same API endpoint.

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(120, "Title is too long."),
  amount: z.string().min(1, "Amount is required."),
  date: z.string().min(1, "Date is required."),
  notes: z.string().max(2000, "Notes are too long.").optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ExpenseEditFormProps {
  groupId: string;
  expenseId: string;
  isOwn: boolean;
  current: {
    title: string;
    totalAmountPaise: number;
    date: string; // ISO date string
    notes: string | null;
  };
}

export function ExpenseEditForm({
  groupId,
  expenseId,
  isOwn,
  current,
}: ExpenseEditFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const currentAmountRupees = (current.totalAmountPaise / 100).toFixed(2);
  const currentDate = current.date.slice(0, 10); // YYYY-MM-DD

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: {
      title: current.title,
      amount: currentAmountRupees,
      date: currentDate,
      notes: current.notes ?? "",
    },
  });

  async function onSubmit(values: FormValues): Promise<void> {
    setServerError(null);

    // Build the patch — only include fields that actually changed
    const patch: Record<string, unknown> = {};
    if (values.title !== current.title) {
      patch.title = values.title;
    }
    const newPaise = Number(rupeesToPaise(values.amount));
    if (newPaise !== current.totalAmountPaise) {
      patch.totalAmount = newPaise;
    }
    if (values.date !== currentDate) {
      patch.date = values.date;
    }
    const newNotes = values.notes?.trim() || null;
    if (newNotes !== current.notes) {
      patch.notes = newNotes;
    }

    if (Object.keys(patch).length === 0) {
      setServerError("No changes detected.");
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/groups/${groupId}/expenses/${expenseId}/proposals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setServerError(body?.error?.message ?? "Couldn't save changes.");
        return;
      }

      const result = (await response.json()) as { applied: boolean };
      if (result.applied) {
        toast.success("Expense updated");
      } else {
        toast.success("Edit proposal created — members have 48h to vote");
      }

      startTransition(() => {
        router.push(`/groups/${groupId}/expenses/${expenseId}`);
        router.refresh();
      });
    } catch {
      setServerError("Couldn't reach the server. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <PremiumInput
        {...register("title")}
        label="Title"
        placeholder="What was this expense for?"
        maxLength={120}
        error={errors.title?.message}
      />

      <div>
        <label htmlFor="edit-amount" className="mb-1.5 block text-[13px] text-text-secondary">
          Amount (in rupees)
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-text-secondary">
            ₹
          </span>
          <input
            {...register("amount")}
            id="edit-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={Boolean(errors.amount)}
            className={cn(
              "block h-12 w-full rounded-2xl border bg-card pl-8 pr-4 text-sm text-text-primary transition",
              "placeholder:text-text-secondary focus:outline-none focus:ring-2",
              errors.amount
                ? "border-error focus:border-error focus:ring-error/10"
                : "border-white/[0.06] focus:border-accent focus:ring-accent/10",
            )}
          />
        </div>
        {errors.amount ? (
          <p className="mt-1.5 text-[12px] text-error">{errors.amount.message}</p>
        ) : (
          <p className="mt-1.5 text-[12px] text-text-secondary">
            Currently {formatPaise(current.totalAmountPaise)}
          </p>
        )}
      </div>

      <PremiumInput
        {...register("date")}
        label="Date"
        type="date"
        error={errors.date?.message}
      />

      <div>
        <label htmlFor="edit-notes" className="mb-1.5 block text-[13px] text-text-secondary">
          Notes <span className="text-text-secondary/60">(optional)</span>
        </label>
        <textarea
          {...register("notes")}
          id="edit-notes"
          rows={3}
          maxLength={2000}
          placeholder="Add any context..."
          className={cn(
            "block w-full resize-none rounded-2xl border border-white/[0.06] bg-card px-4 py-3 text-sm text-text-primary transition",
            "placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent/10",
          )}
        />
        {errors.notes ? (
          <p className="mt-1.5 text-[12px] text-error">{errors.notes.message}</p>
        ) : null}
      </div>

      {!isOwn ? (
        <div className="rounded-2xl border border-warning/20 bg-warning/5 px-4 py-3">
          <p className="text-[13px] text-warning">
            Since you didn&apos;t create this expense, your changes will be submitted as a
            proposal. Other members have 48 hours to vote.
          </p>
        </div>
      ) : null}

      {serverError ? (
        <div
          role="alert"
          className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-[13px] text-error"
        >
          {serverError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-2xl border border-white/[0.06] bg-card px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-white/10 hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className={cn(
            "rounded-2xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#0E1116] transition",
            "hover:opacity-90",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {isSubmitting
            ? "Saving..."
            : isOwn
              ? "Save changes"
              : "Propose edit"}
        </button>
      </div>
    </form>
  );
}
