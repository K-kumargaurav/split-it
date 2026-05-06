import { z } from "zod";

// Schemas for recurring expense templates per SPEC §4.3. Mirrors the create-
// expense schema where it makes sense, but `participantConfig` is stored as
// JSON in `recurring_templates.participant_config`, so the discriminant lives
// inside the JSON object rather than as a top-level field on the table.

const PAISE_MIN = 1;
const PAISE_MAX = 1_000_000_000;

export const paiseAmountSchema = z
  .number()
  .int({ message: "Amount must be an integer (paise)." })
  .min(PAISE_MIN, { message: "Amount must be at least 1 paise." })
  .max(PAISE_MAX, { message: "Amount exceeds the maximum allowed." });

export const recurringFrequencySchema = z.enum([
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "YEARLY",
]);

export type RecurringFrequencyInput = z.infer<typeof recurringFrequencySchema>;

const equalConfigSchema = z.object({
  splitType: z.literal("EQUAL"),
  participantIds: z
    .array(z.string().uuid({ message: "Participant id must be a UUID." }))
    .min(1, { message: "At least one participant is required." }),
});

const exactConfigSchema = z.object({
  splitType: z.literal("EXACT"),
  splits: z
    .array(
      z.object({
        userId: z.string().uuid({ message: "Participant id must be a UUID." }),
        amountPaise: z
          .number()
          .int({ message: "Exact amount must be an integer (paise)." })
          .min(0, { message: "Exact amount must be zero or more." })
          .max(PAISE_MAX, { message: "Exact amount exceeds the maximum allowed." }),
      }),
    )
    .min(1, { message: "At least one participant is required." }),
});

const percentageConfigSchema = z.object({
  splitType: z.literal("PERCENTAGE"),
  splits: z
    .array(
      z.object({
        userId: z.string().uuid({ message: "Participant id must be a UUID." }),
        percentage: z
          .number()
          .min(0, { message: "Percentage must be zero or more." })
          .max(100, { message: "Percentage cannot exceed 100." }),
      }),
    )
    .min(1, { message: "At least one participant is required." }),
});

export const participantConfigSchema = z.discriminatedUnion("splitType", [
  equalConfigSchema,
  exactConfigSchema,
  percentageConfigSchema,
]);

export type ParticipantConfig = z.infer<typeof participantConfigSchema>;

// Date is taken as ISO-8601 (YYYY-MM-DD or full datetime) and coerced. We
// normalise to a UTC midnight `@db.Date` value at write time so cron
// comparisons work regardless of the server's timezone.
const isoDateSchema = z.coerce.date({ message: "Date must be a valid ISO date." });

// nextRunDate must not be in the past. Compared against today's date (UTC
// midnight) so a date of "today" is always accepted regardless of time-of-day.
const futureOrTodayDateSchema = isoDateSchema.refine(
  (d) => d >= new Date(new Date().toDateString()),
  { message: "First run date cannot be in the past." },
);

export const createRecurringTemplateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Title is required." })
    .max(120, { message: "Title is too long." }),
  categoryId: z.string().uuid().nullable().optional(),
  amountPaise: paiseAmountSchema,
  taxAmountPaise: paiseAmountSchema.or(z.literal(0)).default(0),
  tipAmountPaise: paiseAmountSchema.or(z.literal(0)).default(0),
  frequency: recurringFrequencySchema,
  nextRunDate: futureOrTodayDateSchema,
  endDate: isoDateSchema.nullable().optional(),
  participantConfig: participantConfigSchema,
});

export type CreateRecurringTemplateInput = z.infer<
  typeof createRecurringTemplateSchema
>;

// Update is a permissive subset — only the fields a user can edit on a live
// template. `groupId` and `createdBy` are immutable; runtime state
// (nextRunDate after a run) is bumped by the cron only, never by the user.
export const updateRecurringTemplateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { message: "Title is required." })
      .max(120, { message: "Title is too long." })
      .optional(),
    categoryId: z.string().uuid().nullable().optional(),
    amountPaise: paiseAmountSchema.optional(),
    taxAmountPaise: paiseAmountSchema.or(z.literal(0)).optional(),
    tipAmountPaise: paiseAmountSchema.or(z.literal(0)).optional(),
    frequency: recurringFrequencySchema.optional(),
    nextRunDate: futureOrTodayDateSchema.optional(),
    endDate: isoDateSchema.nullable().optional(),
    participantConfig: participantConfigSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (v) => Object.keys(v).length > 0,
    { message: "Provide at least one field to update." },
  );

export type UpdateRecurringTemplateInput = z.infer<
  typeof updateRecurringTemplateSchema
>;
