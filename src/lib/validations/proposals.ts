import { z } from "zod";

// Proposable expense changes (SPEC §4.9). Kept narrow on purpose — v1 only
// allows patching the lightweight fields. Mutating split shape requires
// re-running the split helpers and is out of scope for the dispute flow:
// users should delete + re-create the expense for those edits.
//
// The schema is shared by:
//   • the API route that creates proposals
//   • the immediate self-edit path (same patch shape)
//   • the JSON stored in `expense_proposals.proposedChanges`

const PAISE_MIN = 1;
const PAISE_MAX = 1_000_000_000;

export const expensePatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    totalAmount: z
      .number()
      .int()
      .min(PAISE_MIN)
      .max(PAISE_MAX)
      .optional(),
    date: z.coerce.date().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((p) => Object.keys(p).length > 0, {
    message: "At least one field must change.",
  });

export type ExpensePatch = z.infer<typeof expensePatchSchema>;

// On-disk shape for ExpenseProposal.proposedChanges. Discriminated so the
// same proposal flow handles both edits and deletions (SPEC §4.9 case 3).
export const proposedChangesSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EDIT"), patch: expensePatchSchema }),
  z.object({ kind: z.literal("DELETE") }),
]);

export type ProposedChanges = z.infer<typeof proposedChangesSchema>;

export const voteSchema = z.object({
  vote: z.enum(["APPROVE", "REJECT"]),
});
