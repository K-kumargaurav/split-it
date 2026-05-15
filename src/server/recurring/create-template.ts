import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  createRecurringTemplateSchema,
  // type CreateRecurringTemplateInput,
  type ParticipantConfig,
} from "@/lib/validations/recurring";

// SPEC §4.3 — recurring templates. The DB stores the discriminated split
// configuration as JSONB on `participant_config`; we keep the Zod-validated
// shape (with `splitType` discriminator) so the cron runner can branch on it
// at expand time without re-querying the column type.

export type CreatedRecurringTemplate = Prisma.RecurringTemplateGetPayload<{
  select: {
    id: true;
    groupId: true;
    title: true;
    categoryId: true;
    amountPaise: true;
    splitType: true;
    participantConfig: true;
    taxAmountPaise: true;
    tipAmountPaise: true;
    frequency: true;
    nextRunDate: true;
    endDate: true;
    isActive: true;
    createdBy: true;
    createdAt: true;
  };
}>;

export async function createRecurringTemplate(
  userId: string,
  groupId: string,
  rawInput: unknown,
): Promise<CreatedRecurringTemplate> {
  const parsed = createRecurringTemplateSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Some fields are invalid.",
      parsed.error.issues.map((i) => ({
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    );
  }
  const input = parsed.data;

  await assertViewerIsMember(userId, groupId);
  await assertConfigParticipantsAreMembers(groupId, input.participantConfig);
  assertParticipantConfigConsistency(input.participantConfig, input.amountPaise);
  if (input.endDate && input.endDate < input.nextRunDate) {
    throw new AppError(
      "VALIDATION_ERROR",
      "End date can't be before the first occurrence.",
      [{ path: ["endDate"], message: "End date must be after the first occurrence." }],
    );
  }

  const template = await prisma.$transaction(async (tx) => {
    const created = await tx.recurringTemplate.create({
      data: {
        groupId,
        title: input.title,
        categoryId: input.categoryId ?? null,
        amountPaise: BigInt(input.amountPaise),
        splitType: input.participantConfig.splitType,
        participantConfig: input.participantConfig as Prisma.InputJsonValue,
        taxAmountPaise: BigInt(input.taxAmountPaise),
        tipAmountPaise: BigInt(input.tipAmountPaise),
        frequency: input.frequency,
        nextRunDate: input.nextRunDate,
        endDate: input.endDate ?? null,
        isActive: true,
        createdBy: userId,
      },
      select: createdSelection,
    });
    await tx.auditLog.create({
      data: {
        groupId,
        actorId: userId,
        entityType: "RECURRING",
        entityId: created.id,
        action: "CREATED",
        newValue: {
          title: created.title,
          amountPaise: input.amountPaise,
          frequency: input.frequency,
          nextRunDate: input.nextRunDate,
          endDate: input.endDate ?? null,
          splitType: input.participantConfig.splitType,
        },
      },
    });
    return created;
  });

  return template;
}

const createdSelection = {
  id: true,
  groupId: true,
  title: true,
  categoryId: true,
  amountPaise: true,
  splitType: true,
  participantConfig: true,
  taxAmountPaise: true,
  tipAmountPaise: true,
  frequency: true,
  nextRunDate: true,
  endDate: true,
  isActive: true,
  createdBy: true,
  createdAt: true,
} as const;

async function assertViewerIsMember(userId: string, groupId: string): Promise<void> {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!m) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }
}

async function assertConfigParticipantsAreMembers(
  groupId: string,
  config: ParticipantConfig,
): Promise<void> {
  const ids =
    config.splitType === "EQUAL"
      ? config.participantIds
      : config.splits.map((s) => s.userId);
  if (ids.length === 0) return;

  const rows = await prisma.groupMember.findMany({
    where: { groupId, userId: { in: ids } },
    select: { userId: true },
  });
  const present = new Set(rows.map((r) => r.userId));
  for (const id of ids) {
    if (!present.has(id)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "All participants must be group members.",
        [{ path: ["participantConfig"], message: `User ${id} is not a member.` }],
      );
    }
  }
}

// EXACT splits must already sum to the total at template creation, since the
// cron runner copies the config verbatim. PERCENTAGE must sum to 100. EQUAL
// has no further constraint beyond a non-empty participant list.
function assertParticipantConfigConsistency(
  config: ParticipantConfig,
  totalPaise: number,
): void {
  if (config.splitType === "EXACT") {
    const sum = config.splits.reduce((s, x) => s + x.amountPaise, 0);
    if (sum !== totalPaise) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Exact amounts sum to ${sum} but template total is ${totalPaise}.`,
        [{ path: ["participantConfig", "splits"], message: "Exact amounts must sum to the total." }],
      );
    }
  }
  if (config.splitType === "PERCENTAGE") {
    const sum = config.splits.reduce((s, x) => s + x.percentage, 0);
    if (sum !== 100) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Percentages sum to ${sum} but must total 100.`,
        [
          {
            path: ["participantConfig", "splits"],
            message: "Percentages must sum to exactly 100.",
          },
        ],
      );
    }
  }
}
