import { z } from "zod";

// Settlement input schema for SPEC §4.5. Money is paise (integer); the
// PAISE_MAX bound mirrors `paiseAmountSchema` in expenses.ts so the two flows
// agree on the per-row ceiling. The receiver and payer are validated server
// side as group members — Zod only checks shape here.

const PAISE_MIN = 1;
const PAISE_MAX = 1_000_000_000;

export const PAYMENT_METHODS = [
  "CASH",
  "UPI",
  "RAZORPAY",
  "STRIPE",
  "OTHER",
] as const;

export const paymentMethodSchema = z.enum(PAYMENT_METHODS, {
  message: "Choose a valid payment method.",
});

export const createSettlementSchema = z.object({
  receiverId: z.string().uuid({ message: "Receiver id must be a UUID." }),
  amountPaise: z
    .number()
    .int({ message: "Amount must be an integer (paise)." })
    .min(PAISE_MIN, { message: "Amount must be at least 1 paise." })
    .max(PAISE_MAX, { message: "Amount exceeds the maximum allowed." }),
  paymentMethod: paymentMethodSchema,
  paymentRef: z
    .string()
    .trim()
    .min(1)
    .max(120, { message: "Payment reference is too long." })
    .nullish(),
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;

export const settlementActionSchema = z.object({
  action: z.enum(["confirm", "dispute"], {
    message: "Action must be 'confirm' or 'dispute'.",
  }),
});

export type SettlementActionInput = z.infer<typeof settlementActionSchema>;
