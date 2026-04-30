import Papa from "papaparse";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

// SPEC §4.13 — CSV export. One row per (expense × participant) so the file
// stays grep-friendly: a single regex over `participant_name` answers "what
// did Alice owe across the trip" without a pivot.
//
// Money is stored in paise (BigInt) per the project rule. We convert to
// rupees only here, in the CSV payload, with two-decimal precision.

export interface ExportCsvInput {
  startDate?: Date;
  endDate?: Date;
}

export interface ExportCsvResult {
  filename: string;
  csv: string;
}

interface CsvRow {
  date: string;
  title: string;
  category: string;
  paid_by: string;
  total_amount_inr: string;
  split_type: "EQUAL" | "EXACT" | "PERCENTAGE";
  participant_name: string;
  participant_share_inr: string;
}

interface ExpenseRowInput {
  date: Date;
  title: string;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE";
  category: { name: string } | null;
  payers: { user: { displayName: string } }[];
  participants: {
    amountPaise: bigint;
    user: { displayName: string };
  }[];
  totalAmount: bigint;
}

const CSV_COLUMNS: readonly (keyof CsvRow)[] = [
  "date",
  "title",
  "category",
  "paid_by",
  "total_amount_inr",
  "split_type",
  "participant_name",
  "participant_share_inr",
];

export async function exportGroupCsv(
  userId: string,
  groupId: string,
  input: ExportCsvInput,
): Promise<ExportCsvResult> {
  await assertMember(groupId, userId);

  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!group) {
    throw new AppError("NOT_FOUND", "Group not found.");
  }

  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      status: "ACTIVE",
      deletedAt: null,
      ...(input.startDate || input.endDate
        ? {
            date: {
              ...(input.startDate ? { gte: input.startDate } : {}),
              ...(input.endDate ? { lte: input.endDate } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      category: { select: { name: true } },
      payers: { include: { user: { select: { displayName: true } } } },
      participants: {
        include: { user: { select: { displayName: true } } },
      },
    },
  });

  const rows = buildRows(expenses);

  // Always emit a header — Papa.unparse drops it when `data` is empty, which
  // would leave the file unreadable by CSV consumers expecting a header row.
  const headerLine = Papa.unparse([CSV_COLUMNS as string[]], { quotes: true });
  const bodyLines = rows.length
    ? Papa.unparse(
        rows.map((r) => CSV_COLUMNS.map((c) => r[c])),
        { quotes: true },
      )
    : "";
  const csv = bodyLines ? `${headerLine}\r\n${bodyLines}` : headerLine;

  return {
    filename: makeFilename(group.name, input),
    csv,
  };
}

export function buildRows(expenses: ExpenseRowInput[]): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const e of expenses) {
    const dateLabel = formatDateDDMMYYYY(e.date);
    const category = e.category?.name ?? "";
    const paidBy = e.payers.map((p) => p.user.displayName).join(", ") || "Unknown";
    const totalRupees = paiseToRupeesString(e.totalAmount);

    if (e.participants.length === 0) {
      rows.push({
        date: dateLabel,
        title: e.title,
        category,
        paid_by: paidBy,
        total_amount_inr: totalRupees,
        split_type: e.splitType,
        participant_name: "",
        participant_share_inr: "0.00",
      });
      continue;
    }

    for (const p of e.participants) {
      rows.push({
        date: dateLabel,
        title: e.title,
        category,
        paid_by: paidBy,
        total_amount_inr: totalRupees,
        split_type: e.splitType,
        participant_name: p.user.displayName,
        participant_share_inr: paiseToRupeesString(p.amountPaise),
      });
    }
  }
  return rows;
}

function paiseToRupeesString(paise: bigint): string {
  const negative = paise < BigInt(0);
  const abs = negative ? -paise : paise;
  const whole = abs / BigInt(100);
  const remainder = abs % BigInt(100);
  const fractional = remainder.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fractional}`;
}

function formatDateDDMMYYYY(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function makeFilename(groupName: string, input: ExportCsvInput): string {
  const slug = groupName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "group";
  const range = formatRangeForFilename(input);
  return `spliteasy-${slug}${range ? `-${range}` : ""}.csv`;
}

function formatRangeForFilename(input: ExportCsvInput): string {
  if (!input.startDate && !input.endDate) return "";
  const fmt = (d?: Date): string => (d ? d.toISOString().slice(0, 10) : "");
  return [fmt(input.startDate), fmt(input.endDate)].filter(Boolean).join("_to_");
}

async function assertMember(groupId: string, userId: string): Promise<void> {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!m) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }
}

export const __testing = {
  buildRows,
  paiseToRupeesString,
  formatDateDDMMYYYY,
  makeFilename,
};
