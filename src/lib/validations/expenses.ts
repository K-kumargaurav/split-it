import { z } from "zod";

// Expense input schema for SPEC §4.2. Three split types are supported and
// modelled as a discriminated union so the server can branch on `splitType`
// and Zod gives us per-branch type-narrowed input.
//
// Money is paise (integers). Bounds match SPEC §4.2 "Expense Amount Bounds":
// minimum 1 paise, maximum 1,000,000,000 paise. The per-expense business
// cap is enforced separately if/when policy tightens.

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

const exactParticipantSplitSchema = z.object({
  userId: z.string().uuid({ message: "Participant id must be a UUID." }),
  amountPaise: z
    .number()
    .int({ message: "Exact amount must be an integer (paise)." })
    .min(0, { message: "Exact amount must be zero or more." })
    .max(PAISE_MAX, { message: "Exact amount exceeds the maximum allowed." }),
});

const percentageParticipantSplitSchema = z.object({
  userId: z.string().uuid({ message: "Participant id must be a UUID." }),
  percentage: z
    .number()
    .min(0, { message: "Percentage must be zero or more." })
    .max(100, { message: "Percentage cannot exceed 100." }),
});

const baseExpenseFields = {
  title: z
    .string()
    .trim()
    .min(1, { message: "Title is required." })
    .max(120, { message: "Title is too long." }),
  categoryId: z.string().uuid().nullable().optional(),
  date: z.coerce.date({ message: "Date must be a valid ISO date." }),
  totalAmount: paiseAmountSchema,
  payerSplits: z
    .array(payerSplitSchema)
    .min(1, { message: "At least one payer is required." }),
};

const equalExpenseSchema = z.object({
  ...baseExpenseFields,
  splitType: z.literal("EQUAL"),
  participantIds: z
    .array(z.string().uuid({ message: "Participant id must be a UUID." }))
    .min(1, { message: "At least one participant is required." }),
});

const exactExpenseSchema = z.object({
  ...baseExpenseFields,
  splitType: z.literal("EXACT"),
  participantSplits: z
    .array(exactParticipantSplitSchema)
    .min(1, { message: "At least one participant is required." }),
});

const percentageExpenseSchema = z.object({
  ...baseExpenseFields,
  splitType: z.literal("PERCENTAGE"),
  participantSplits: z
    .array(percentageParticipantSplitSchema)
    .min(1, { message: "At least one participant is required." }),
});

export const createExpenseSchema = z.discriminatedUnion("splitType", [
  equalExpenseSchema,
  exactExpenseSchema,
  percentageExpenseSchema,
]);

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateExpenseEqualInput = z.infer<typeof equalExpenseSchema>;
export type CreateExpenseExactInput = z.infer<typeof exactExpenseSchema>;
export type CreateExpensePercentageInput = z.infer<typeof percentageExpenseSchema>;
