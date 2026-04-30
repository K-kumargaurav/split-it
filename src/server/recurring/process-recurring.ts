import type {
  Prisma,
  PrismaClient,
  RecurringFrequency,
} from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { equalSplit, exactSplit, percentageSplit } from "@/lib/split";
import { formatPaise } from "@/lib/format";
import {
  participantConfigSchema,
  type ParticipantConfig,
} from "@/lib/validations/recurring";
import { notifyGroupMembersAfterCommit } from "@/server/notifications/create-notification";

// SPEC §4.3 — daily cron sweep. Every active template whose `nextRunDate` is
// today or earlier produces one new expense, the template's `nextRunDate` is
// advanced by one frequency tick, and `isActive` is flipped off when the new
// next-run would exceed `endDate`.
//
// Failure isolation: we run each template inside its own transaction so a
// single bad template (e.g. zero remaining members) doesn't poison the
// whole batch. Errors are logged and we move on.

interface TemplateRow {
  id: string;
  groupId: string;
  title: string;
  categoryId: string | null;
  amountPaise: bigint;
  taxAmountPaise: bigint;
  tipAmountPaise: bigint;
  frequency: RecurringFrequency;
  nextRunDate: Date;
  endDate: Date | null;
  isActive: boolean;
  participantConfig: Prisma.JsonValue;
  createdBy: string;
}

export interface ProcessRecurringResult {
  processed: number;
  created: number;
  failed: number;
  failures: { templateId: string; reason: string }[];
}

const NOTES_AUTO_GENERATED = "auto_generated";

// Public entrypoint for the cron route. `now` is injectable so unit tests can
// drive a deterministic clock without monkey-patching `Date`.
export async function processRecurringExpenses(
  now: Date = new Date(),
): Promise<ProcessRecurringResult> {
  const today = startOfDayUtc(now);
  const due = await prisma.recurringTemplate.findMany({
    where: {
      isActive: true,
      nextRunDate: { lte: today },
    },
    select: TEMPLATE_SELECT,
  });

  let created = 0;
  const failures: { templateId: string; reason: string }[] = [];

  for (const tpl of due) {
    try {
      const result = await prisma.$transaction((tx) =>
        runOneTemplate(tx, tpl, today),
      );
      if (result.expenseId) {
        created += 1;
        // Fire-and-forget — running outside the transaction is intentional so
        // a push/whatsapp hiccup never rolls back the expense write.
        void notifyGroupMembersAfterCommit(tpl.groupId, [], {
          type: "RECURRING_EXPENSE_ADDED",
          title: "Recurring expense auto-added",
          body: `Recurring expense '${tpl.title}' was auto-added — ${formatPaise(
            Number(tpl.amountPaise),
          )}.`,
          entityType: "EXPENSE",
          entityId: result.expenseId,
        });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      console.error(`[recurring] template ${tpl.id} failed:`, err);
      failures.push({ templateId: tpl.id, reason });
    }
  }

  return {
    processed: due.length,
    created,
    failed: failures.length,
    failures,
  };
}

const TEMPLATE_SELECT = {
  id: true,
  groupId: true,
  title: true,
  categoryId: true,
  amountPaise: true,
  taxAmountPaise: true,
  tipAmountPaise: true,
  frequency: true,
  nextRunDate: true,
  endDate: true,
  isActive: true,
  participantConfig: true,
  createdBy: true,
} as const;

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

interface RunResult {
  expenseId: string | null;
  newNextRunDate: Date;
  deactivated: boolean;
}

async function runOneTemplate(
  tx: Tx,
  tpl: TemplateRow,
  today: Date,
): Promise<RunResult> {
  const config = parseConfig(tpl.participantConfig);
  const totalPaise = Number(tpl.amountPaise);
  const { participantIds, shares } = resolveSplit(config, totalPaise);
  if (participantIds.length === 0) {
    throw new Error("Template has no participants.");
  }

  // Reconcile against current group membership — per SPEC §4.3 the expense
  // is created with current members. Drop participants who are no longer in
  // the group; if all are gone, fail this template (the cron caller logs it).
  const memberRows = await tx.groupMember.findMany({
    where: { groupId: tpl.groupId, userId: { in: participantIds } },
    select: { userId: true },
  });
  const stillMembers = new Set(memberRows.map((r) => r.userId));
  const filtered = participantIds
    .map((id, i) => ({ id, share: shares[i]! }))
    .filter((p) => stillMembers.has(p.id));
  if (filtered.length === 0) {
    throw new Error("No remaining group members for this template.");
  }
  // Re-balance after filtering so the new shares still sum to total. We
  // redistribute the missing-member portions across the remaining filtered
  // participants by re-running the split (EQUAL re-equalises, others scale
  // proportionally).
  const finalShares = rebalanceShares(
    config,
    filtered.map((f) => f.id),
    totalPaise,
    filtered,
  );

  // Single payer = the template creator (still validated as a member).
  const payer = await tx.groupMember.findUnique({
    where: { groupId_userId: { groupId: tpl.groupId, userId: tpl.createdBy } },
    select: { userId: true },
  });
  if (!payer) {
    throw new Error("Template creator is no longer a group member.");
  }

  const expense = await tx.expense.create({
    data: {
      groupId: tpl.groupId,
      title: tpl.title,
      categoryId: tpl.categoryId,
      baseAmount: BigInt(totalPaise),
      taxAmount: tpl.taxAmountPaise,
      tipAmount: tpl.tipAmountPaise,
      totalAmount: BigInt(totalPaise),
      splitType: config.splitType,
      date: today,
      notes: NOTES_AUTO_GENERATED,
      recurringId: tpl.id,
      createdBy: tpl.createdBy,
      payers: {
        create: [{ userId: payer.userId, amountPaise: BigInt(totalPaise) }],
      },
      participants: {
        create: filtered.map((p, i) => ({
          userId: p.id,
          amountPaise: BigInt(finalShares[i]!),
        })),
      },
    },
    select: { id: true },
  });

  await tx.auditLog.create({
    data: {
      groupId: tpl.groupId,
      actorId: tpl.createdBy,
      entityType: "EXPENSE",
      entityId: expense.id,
      action: "CREATED",
      newValue: {
        via: "recurring",
        templateId: tpl.id,
        amountPaise: totalPaise,
        splitType: config.splitType,
      },
    },
  });

  const newNextRunDate = advanceNextRunDate(tpl.nextRunDate, tpl.frequency);
  const deactivated = !!tpl.endDate && newNextRunDate > tpl.endDate;
  await tx.recurringTemplate.update({
    where: { id: tpl.id },
    data: {
      nextRunDate: newNextRunDate,
      isActive: deactivated ? false : tpl.isActive,
    },
  });

  return { expenseId: expense.id, newNextRunDate, deactivated };
}

function parseConfig(raw: Prisma.JsonValue): ParticipantConfig {
  const parsed = participantConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid participantConfig JSON: " + parsed.error.message);
  }
  return parsed.data;
}

function resolveSplit(
  config: ParticipantConfig,
  totalPaise: number,
): { participantIds: string[]; shares: number[] } {
  if (config.splitType === "EQUAL") {
    const shares = equalSplit(totalPaise, config.participantIds.length);
    return { participantIds: config.participantIds, shares };
  }
  if (config.splitType === "EXACT") {
    const ids = config.splits.map((s) => s.userId);
    const amounts = config.splits.map((s) => s.amountPaise);
    const shares = exactSplit(totalPaise, amounts);
    return { participantIds: ids, shares };
  }
  // PERCENTAGE
  const ids = config.splits.map((s) => s.userId);
  const pcts = config.splits.map((s) => s.percentage);
  const shares = percentageSplit(totalPaise, pcts);
  return { participantIds: ids, shares };
}

// When some configured participants have left the group, recompute shares so
// the remaining members absorb the dropped portions and sums still equal the
// total. EQUAL re-equalises; PERCENTAGE re-scales proportionally; EXACT
// keeps the per-member amounts and rebalances the deficit equally onto
// the survivors so the total invariant holds.
function rebalanceShares(
  config: ParticipantConfig,
  remainingIds: string[],
  totalPaise: number,
  filtered: { id: string; share: number }[],
): number[] {
  if (config.splitType === "EQUAL") {
    return equalSplit(totalPaise, remainingIds.length);
  }
  const original = filtered.reduce((s, x) => s + x.share, 0);
  if (original === totalPaise) {
    return filtered.map((f) => f.share);
  }
  if (config.splitType === "PERCENTAGE") {
    // Pull the percentages for survivors and rescale to 100 — the helper
    // takes care of remainder paise.
    const pcts = remainingIds.map((id) => {
      const s = config.splits.find((x) => x.userId === id);
      return s?.percentage ?? 0;
    });
    const sum = pcts.reduce((s, x) => s + x, 0);
    if (sum === 0) return equalSplit(totalPaise, remainingIds.length);
    const rescaled = pcts.map((p) => (p * 100) / sum);
    return percentageSplit(totalPaise, rescaled);
  }
  // EXACT — distribute the deficit equally on top of the kept amounts.
  const deficit = totalPaise - original;
  const each = Math.floor(deficit / filtered.length);
  let remainder = deficit - each * filtered.length;
  return filtered.map((f, i) => {
    let v = f.share + each;
    if (i === filtered.length - 1) v += remainder;
    return v;
  });
}

// Frequency advance with calendar safety:
//   • DAILY/WEEKLY/BIWEEKLY: simple day arithmetic.
//   • MONTHLY: same day-of-month next month, or the last day of that month
//     if the target day overflows (Jan 31 → Feb 28/29).
//   • YEARLY: same calendar day next year (Feb 29 in a leap year follows the
//     same overflow rule and lands on Feb 28).
export function advanceNextRunDate(from: Date, freq: RecurringFrequency): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();

  switch (freq) {
    case "DAILY":
      return new Date(Date.UTC(y, m, d + 1));
    case "WEEKLY":
      return new Date(Date.UTC(y, m, d + 7));
    case "BIWEEKLY":
      return new Date(Date.UTC(y, m, d + 14));
    case "MONTHLY":
      return clampToEndOfMonth(y, m + 1, d);
    case "YEARLY":
      return clampToEndOfMonth(y + 1, m, d);
    default: {
      const _exhaustive: never = freq;
      throw new Error(`Unhandled frequency: ${String(_exhaustive)}`);
    }
  }
}

function clampToEndOfMonth(year: number, month: number, day: number): Date {
  // `new Date(Date.UTC(year, month, 0))` returns the last day of the previous
  // month — so for the *target* month we use day 0 of month+1.
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const useDay = Math.min(day, lastDay);
  return new Date(Date.UTC(year, month, useDay));
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export const __testing = {
  advanceNextRunDate,
  resolveSplit,
  rebalanceShares,
  parseConfig,
  startOfDayUtc,
};
