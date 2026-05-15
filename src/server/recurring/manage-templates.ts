import type { Prisma, RecurringFrequency, SplitType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { serializePaise } from "@/lib/api-response";
import {
  updateRecurringTemplateSchema,
  type UpdateRecurringTemplateInput,
} from "@/lib/validations/recurring";

// Read / update / delete for recurring templates. Membership gate funnels
// through `assertViewerIsMember` so a non-member never sees a template they
// shouldn't, and a non-member can't pause/edit/delete one either.

export interface RecurringTemplateRow {
  id: string;
  title: string;
  amountPaise: string;
  splitType: SplitType;
  frequency: RecurringFrequency;
  nextRunDate: Date;
  endDate: Date | null;
  isActive: boolean;
  participantConfig: Prisma.JsonValue;
  taxAmountPaise: string;
  tipAmountPaise: string;
  categoryId: string | null;
  createdAt: Date;
  createdBy: string;
}

export async function listRecurringTemplates(
  userId: string,
  groupId: string,
): Promise<RecurringTemplateRow[]> {
  await assertViewerIsMember(userId, groupId);
  const rows = await prisma.recurringTemplate.findMany({
    where: { groupId },
    orderBy: [{ isActive: "desc" }, { nextRunDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      amountPaise: true,
      splitType: true,
      frequency: true,
      nextRunDate: true,
      endDate: true,
      isActive: true,
      participantConfig: true,
      taxAmountPaise: true,
      tipAmountPaise: true,
      categoryId: true,
      createdAt: true,
      createdBy: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    amountPaise: serializePaise(r.amountPaise),
    splitType: r.splitType,
    frequency: r.frequency,
    nextRunDate: r.nextRunDate,
    endDate: r.endDate,
    isActive: r.isActive,
    participantConfig: r.participantConfig,
    taxAmountPaise: serializePaise(r.taxAmountPaise),
    tipAmountPaise: serializePaise(r.tipAmountPaise),
    categoryId: r.categoryId,
    createdAt: r.createdAt,
    createdBy: r.createdBy,
  }));
}

export async function updateRecurringTemplate(
  userId: string,
  groupId: string,
  templateId: string,
  rawInput: unknown,
): Promise<RecurringTemplateRow> {
  const parsed = updateRecurringTemplateSchema.safeParse(rawInput);
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
  const input: UpdateRecurringTemplateInput = parsed.data;

  await assertViewerIsMember(userId, groupId);
  const existing = await prisma.recurringTemplate.findFirst({
    where: { id: templateId, groupId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Recurring template not found.");
  }

  const data: Prisma.RecurringTemplateUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.categoryId !== undefined) {
    data.category = input.categoryId
      ? { connect: { id: input.categoryId } }
      : { disconnect: true };
  }
  if (input.amountPaise !== undefined) data.amountPaise = BigInt(input.amountPaise);
  if (input.taxAmountPaise !== undefined) data.taxAmountPaise = BigInt(input.taxAmountPaise);
  if (input.tipAmountPaise !== undefined) data.tipAmountPaise = BigInt(input.tipAmountPaise);
  if (input.frequency !== undefined) data.frequency = input.frequency;
  if (input.nextRunDate !== undefined) data.nextRunDate = input.nextRunDate;
  if (input.endDate !== undefined) data.endDate = input.endDate;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.participantConfig !== undefined) {
    data.splitType = input.participantConfig.splitType;
    data.participantConfig = input.participantConfig as Prisma.InputJsonValue;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.recurringTemplate.update({
      where: { id: templateId },
      data,
      select: {
        id: true,
        title: true,
        amountPaise: true,
        splitType: true,
        frequency: true,
        nextRunDate: true,
        endDate: true,
        isActive: true,
        participantConfig: true,
        taxAmountPaise: true,
        tipAmountPaise: true,
        categoryId: true,
        createdAt: true,
        createdBy: true,
      },
    });
    await tx.auditLog.create({
      data: {
        groupId,
        actorId: userId,
        entityType: "RECURRING",
        entityId: templateId,
        action: "UPDATED",
        newValue: input as Prisma.InputJsonValue,
      },
    });
    return row;
  });

  return {
    id: updated.id,
    title: updated.title,
    amountPaise: serializePaise(updated.amountPaise),
    splitType: updated.splitType,
    frequency: updated.frequency,
    nextRunDate: updated.nextRunDate,
    endDate: updated.endDate,
    isActive: updated.isActive,
    participantConfig: updated.participantConfig,
    taxAmountPaise: serializePaise(updated.taxAmountPaise),
    tipAmountPaise: serializePaise(updated.tipAmountPaise),
    categoryId: updated.categoryId,
    createdAt: updated.createdAt,
    createdBy: updated.createdBy,
  };
}

// Per SPEC §4.3: "Deleting a template does not delete past expenses it
// generated." We hard-delete the template row but leave generated expenses
// (linked via `expenses.recurring_id`) intact — Prisma's relation defaults
// to ON DELETE SET NULL? It defaults to RESTRICT. Switch to soft-delete via
// `isActive=false` if the FK fails; otherwise nullify the FK first.
export async function deleteRecurringTemplate(
  userId: string,
  groupId: string,
  templateId: string,
): Promise<void> {
  await assertViewerIsMember(userId, groupId);
  const existing = await prisma.recurringTemplate.findFirst({
    where: { id: templateId, groupId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Recurring template not found.");
  }

  await prisma.$transaction(async (tx) => {
    // Detach generated expenses so the template can be removed without
    // dropping history. Per §4.3 past auto-generated expenses must persist.
    await tx.expense.updateMany({
      where: { recurringId: templateId },
      data: { recurringId: null },
    });
    await tx.recurringTemplate.delete({ where: { id: templateId } });
    await tx.auditLog.create({
      data: {
        groupId,
        actorId: userId,
        entityType: "RECURRING",
        entityId: templateId,
        action: "DELETED",
        oldValue: { templateId },
      },
    });
  });
}

async function assertViewerIsMember(userId: string, groupId: string): Promise<void> {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!m) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }
}
