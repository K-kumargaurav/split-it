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

// Query-string filter shape for the search endpoint (SPEC §4.14). Every field
// is optional and arrives as a raw string. Empty strings are treated as
// absent so the filter UI can clear individual fields by sending `?paidBy=`
// rather than omitting the key.

const emptyToUndefined = (v: unknown): unknown =>
  typeof v === "string" && v.trim().length === 0 ? undefined : v;

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

const optionalUuid = z.preprocess(
  emptyToUndefined,
  z.string().uuid({ message: "Must be a valid UUID." }).optional(),
);

const optionalBigIntPaise = z.preprocess(
  emptyToUndefined,
  z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      try {
        const n = typeof v === "number" ? BigInt(Math.trunc(v)) : BigInt(v);
        if (n < BigInt(0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Amount must be zero or more.",
          });
          return z.NEVER;
        }
        return n;
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount must be an integer (paise).",
        });
        return z.NEVER;
      }
    })
    .optional(),
);

const optionalKeyword = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(200).optional(),
);

export const expenseFiltersSchema = z.object({
  dateFrom: optionalDate,
  dateTo: optionalDate,
  categoryId: optionalUuid,
  paidBy: optionalUuid,
  involves: optionalUuid,
  minAmount: optionalBigIntPaise,
  maxAmount: optionalBigIntPaise,
  keyword: optionalKeyword,
});

export type ExpenseFiltersInput = z.infer<typeof expenseFiltersSchema>;
