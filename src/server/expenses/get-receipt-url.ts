import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getReceiptsBucket, getSupabaseStorageClient } from "@/lib/supabase-storage";
import { RECEIPT_SIGNED_URL_TTL_SECONDS } from "./upload-receipt";

// Generates a fresh 1-hour signed URL for a receipt that is stored as a path
// on expense.receiptUrl. Signed URLs expire; by generating them on-demand we
// never persist an expired URL in the database.

export async function getReceiptSignedUrl(
  userId: string,
  groupId: string,
  expenseId: string,
): Promise<string> {
  // Auth gate: caller must be a group member and the expense must belong to
  // the group (same double-check as upload-receipt).
  const [membership, expense] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    }),
    prisma.expense.findUnique({
      where: { id: expenseId },
      select: { id: true, groupId: true, receiptUrl: true },
    }),
  ]);

  if (!membership) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }
  if (!expense || expense.groupId !== groupId) {
    throw new AppError("NOT_FOUND", "Expense not found in this group.");
  }
  if (!expense.receiptUrl) {
    throw new AppError("NOT_FOUND", "No receipt has been uploaded for this expense.");
  }

  const supabase = getSupabaseStorageClient();
  const bucket = getReceiptsBucket();
  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(expense.receiptUrl, RECEIPT_SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Failed to sign receipt URL: ${signError?.message ?? "unknown error"}`,
    );
  }

  return signed.signedUrl;
}
