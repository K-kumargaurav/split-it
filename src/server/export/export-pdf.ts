import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  calculateDirectBalances,
  type BalanceMap,
} from "@/server/balance/calculate-balances";

// SPEC §4.13 — PDF export. Server-side rendering with @react-pdf/renderer.
// We pre-compute everything (group meta, member balances, expenses,
// settlements) before rendering so the React tree is pure and synchronous.

export interface ExportPdfInput {
  startDate?: Date;
  endDate?: Date;
}

export interface ExportPdfResult {
  filename: string;
  pdf: Buffer;
}

interface MemberLine {
  userId: string;
  displayName: string;
  netBalancePaise: bigint;
}

interface ExpenseLine {
  date: string;
  title: string;
  category: string;
  paidBy: string;
  amount: string;
  splitType: string;
}

interface SettlementLine {
  date: string;
  payer: string;
  receiver: string;
  amount: string;
  status: string;
}

interface GroupMeta {
  name: string;
  currency: string;
  startLabel: string;
  endLabel: string;
  exportedAt: string;
}

const ZERO = BigInt(0);

export async function exportGroupPdf(
  userId: string,
  groupId: string,
  input: ExportPdfInput,
): Promise<ExportPdfResult> {
  await assertMember(groupId, userId);

  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      id: true,
      name: true,
      currency: true,
      members: {
        select: {
          user: { select: { id: true, displayName: true } },
        },
      },
    },
  });
  if (!group) {
    throw new AppError("NOT_FOUND", "Group not found.");
  }

  const dateRangeFilter =
    input.startDate || input.endDate
      ? {
          date: {
            ...(input.startDate ? { gte: input.startDate } : {}),
            ...(input.endDate ? { lte: input.endDate } : {}),
          },
        }
      : {};

  const settlementDateFilter =
    input.startDate || input.endDate
      ? {
          createdAt: {
            ...(input.startDate ? { gte: input.startDate } : {}),
            ...(input.endDate ? { lte: input.endDate } : {}),
          },
        }
      : {};

  const [expenses, settlements, balances] = await Promise.all([
    prisma.expense.findMany({
      where: {
        groupId,
        status: "ACTIVE",
        deletedAt: null,
        ...dateRangeFilter,
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: {
        category: { select: { name: true } },
        payers: { include: { user: { select: { displayName: true } } } },
      },
    }),
    prisma.settlement.findMany({
      where: {
        groupId,
        deletedAt: null,
        ...settlementDateFilter,
      },
      orderBy: [{ createdAt: "asc" }],
      include: {
        payer: { select: { displayName: true } },
        ghostPayer: { select: { displayName: true } },
        receiver: { select: { displayName: true } },
      },
    }),
    calculateDirectBalances(groupId, userId),
  ]);

  const memberLines = computeMemberLines(group.members, balances);

  const expenseLines: ExpenseLine[] = expenses.map((e) => ({
    date: formatDate(e.date),
    title: e.title,
    category: e.category?.name ?? "—",
    paidBy: e.payers.map((p) => p.user.displayName).join(", ") || "—",
    amount: formatMoney(e.totalAmount, group.currency),
    splitType: e.splitType,
  }));

  const settlementLines: SettlementLine[] = settlements.map((s) => ({
    date: formatDate(s.confirmedAt ?? s.createdAt),
    // Ghost-paid rows: payer is null, fall back to the ghost displayName.
    payer: s.payer?.displayName ?? s.ghostPayer?.displayName ?? "Guest",
    receiver: s.receiver.displayName,
    amount: formatMoney(s.amountPaise, group.currency),
    status: s.status,
  }));

  const meta: GroupMeta = {
    name: group.name,
    currency: group.currency,
    startLabel: input.startDate ? formatDate(input.startDate) : "—",
    endLabel: input.endDate ? formatDate(input.endDate) : "—",
    exportedAt: formatDate(new Date()),
  };

  const buffer = await renderPdf(
    meta,
    memberLines.map((m) => ({
      displayName: m.displayName,
      net: formatSignedMoney(m.netBalancePaise, group.currency),
    })),
    expenseLines,
    settlementLines,
  );

  return {
    filename: makeFilename(group.name, input),
    pdf: buffer,
  };
}

function computeMemberLines(
  members: { user: { id: string; displayName: string } }[],
  balances: BalanceMap,
): MemberLine[] {
  return members.map(({ user }) => {
    let net = ZERO;
    for (const amount of Object.values(balances[user.id] ?? {})) {
      net += amount;
    }
    for (const [creditorId, debts] of Object.entries(balances)) {
      if (creditorId === user.id) continue;
      const owed = debts[user.id];
      if (owed) net -= owed;
    }
    return { userId: user.id, displayName: user.displayName, netBalancePaise: net };
  });
}

async function renderPdf(
  meta: GroupMeta,
  memberLines: { displayName: string; net: string }[],
  expenseLines: ExpenseLine[],
  settlementLines: SettlementLine[],
): Promise<Buffer> {
  const doc = buildDocument(meta, memberLines, expenseLines, settlementLines);
  const stream = await pdf(doc).toBuffer();
  return streamToBuffer(stream);
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 16, borderBottom: "1pt solid #cbd5e1", paddingBottom: 12 },
  brand: { fontSize: 18, fontWeight: 700, color: "#4f46e5" },
  groupName: { fontSize: 14, marginTop: 4, color: "#0f172a" },
  metaLine: { fontSize: 9, color: "#475569", marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 6, color: "#0f172a" },
  table: { width: "100%", borderTop: "1pt solid #e2e8f0" },
  row: {
    flexDirection: "row",
    borderBottom: "1pt solid #e2e8f0",
    paddingVertical: 4,
  },
  thRow: { backgroundColor: "#f1f5f9" },
  cell: { paddingHorizontal: 4, fontSize: 9, color: "#0f172a" },
  th: { fontWeight: 700, color: "#1e293b" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
  },
});

const expenseColumnWidths = ["12%", "26%", "14%", "20%", "16%", "12%"] as const;
const settlementColumnWidths = ["18%", "26%", "26%", "16%", "14%"] as const;
const memberColumnWidths = ["70%", "30%"] as const;

function buildDocument(
  meta: GroupMeta,
  memberLines: { displayName: string; net: string }[],
  expenseLines: ExpenseLine[],
  settlementLines: SettlementLine[],
): ReactElement {
  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: "A4", style: styles.page },
      createElement(
        View,
        { style: styles.header },
        createElement(Text, { style: styles.brand }, "SplitEasy"),
        createElement(Text, { style: styles.groupName }, meta.name),
        createElement(
          Text,
          { style: styles.metaLine },
          `Currency: ${meta.currency} · Range: ${meta.startLabel} → ${meta.endLabel} · Exported: ${meta.exportedAt}`,
        ),
      ),
      // Members
      createElement(Text, { style: styles.sectionTitle }, "Members & net balances"),
      buildTable(
        memberColumnWidths as readonly string[],
        ["Member", "Net balance"],
        memberLines.map((m) => [m.displayName, m.net]),
      ),
      // Expenses
      createElement(Text, { style: styles.sectionTitle }, "Expenses"),
      buildTable(
        expenseColumnWidths as readonly string[],
        ["Date", "Title", "Category", "Paid by", "Amount", "Split"],
        expenseLines.length === 0
          ? [["—", "No expenses in range", "", "", "", ""]]
          : expenseLines.map((e) => [
              e.date,
              e.title,
              e.category,
              e.paidBy,
              e.amount,
              e.splitType,
            ]),
      ),
      // Settlements
      createElement(Text, { style: styles.sectionTitle }, "Settlements"),
      buildTable(
        settlementColumnWidths as readonly string[],
        ["Date", "From", "To", "Amount", "Status"],
        settlementLines.length === 0
          ? [["—", "No settlements in range", "", "", ""]]
          : settlementLines.map((s) => [s.date, s.payer, s.receiver, s.amount, s.status]),
      ),
      createElement(
        Text,
        { style: styles.footer, fixed: true },
        "Generated by SplitEasy",
      ),
    ),
  );
}

function buildTable(
  widths: readonly string[],
  headers: string[],
  rows: string[][],
): ReactElement {
  return createElement(
    View,
    { style: styles.table },
    createElement(
      View,
      { style: [styles.row, styles.thRow] },
      ...headers.map((h, i) =>
        createElement(
          Text,
          {
            key: `h-${i}`,
            style: [styles.cell, styles.th, { width: widths[i] }],
          },
          h,
        ),
      ),
    ),
    ...rows.map((row, ri) =>
      createElement(
        View,
        { style: styles.row, key: `r-${ri}` },
        ...row.map((value, ci) =>
          createElement(
            Text,
            { key: `c-${ri}-${ci}`, style: [styles.cell, { width: widths[ci] }] },
            value,
          ),
        ),
      ),
    ),
  );
}

function formatMoney(paise: bigint, currency: string): string {
  const sign = paise < ZERO ? "-" : "";
  const abs = paise < ZERO ? -paise : paise;
  const whole = abs / BigInt(100);
  const fraction = (abs % BigInt(100)).toString().padStart(2, "0");
  return `${sign}${currency} ${whole.toString()}.${fraction}`;
}

function formatSignedMoney(paise: bigint, currency: string): string {
  if (paise === ZERO) return `${currency} 0.00`;
  const positive = paise > ZERO;
  const abs = positive ? paise : -paise;
  const whole = abs / BigInt(100);
  const fraction = (abs % BigInt(100)).toString().padStart(2, "0");
  const prefix = positive ? "+" : "-";
  return `${prefix}${currency} ${whole.toString()}.${fraction}`;
}

function formatDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function makeFilename(groupName: string, input: ExportPdfInput): string {
  const slug =
    groupName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "group";
  const range = [input.startDate, input.endDate]
    .map((d) => (d ? d.toISOString().slice(0, 10) : ""))
    .filter(Boolean)
    .join("_to_");
  return `spliteasy-${slug}${range ? `-${range}` : ""}.pdf`;
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
