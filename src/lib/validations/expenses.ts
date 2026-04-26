import { z } from "zod";

// Expense input schema for §4.2 — EQUAL split only in this iteration. Other
// split types share the same wire shape (payerSplits + participantIds), so the
// server can switch on `splitType` once EXACT/PERCENTAGE land.
//
// Money is paise (integers). Bounds match SPEC §4.2 "Expense Amount Bounds":
// minimum 1 paise, maximum 1,000,000,000 paise (₹1 crore — superset of the
// ₹10 lakh per-expense limit, kept here so the schema doesn't reject the
// legacy ceiling). The per-expense business cap is enforced separately if/
// when policy tightens.

const PAISE_MIN = 1;
const PAISE_MAX = 1_000_000_000;

export const paiseAmountSchema = z
  .number()
  .int({ message: "Amount must be an integer (paise)." })
  .min(PAISE_MIN, { message: "Amount must be at least 1 paise." })
  .max(PAISE_MAX, { message: "Amount exceeds the maximum allowed." });

export const payerSplitSchema = z.object({
  userId: z.string().uuid({ message: "Payer id must be a UUID." }),
  amountPaise: paiseAmountSchema,
});

export const createExpenseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Title is required." })
    .max(120, { message: "Title is too long." }),
  categoryId: z.string().uuid().nullable().optional(),
  date: z.coerce.date({ message: "Date must be a valid ISO date." }),
  totalAmount: paiseAmountSchema,
  splitType: z.literal("EQUAL"),
  payerSplits: z
    .array(payerSplitSchema)
    .min(1, { message: "At least one payer is required." }),
  participantIds: z
    .array(z.string().uuid({ message: "Participant id must be a UUID." }))
    .min(1, { message: "At least one participant is required." }),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
