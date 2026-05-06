import sharp from "sharp";

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getReceiptsBucket, getSupabaseStorageClient } from "@/lib/supabase-storage";

// Receipt upload pipeline (SPEC §4.8):
//   1. validate mime + size
//   2. resize images to 2048px longest edge → WebP (sharp, in-memory)
//   3. upload to Supabase Storage at receipts/{groupId}/{expenseId}.{ext}
//   4. generate a signed URL (private bucket, never public)
//   5. write the signed URL onto expense.receiptUrl
//
// PDFs are uploaded as-is per spec — the 10MB limit still applies.

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const RECEIPT_LONGEST_EDGE_PX = 2048;
export const RECEIPT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export interface UploadReceiptResult {
  receiptUrl: string;
  storagePath: string;
  processedBuffer: Buffer;
  processedMimeType: "image/webp" | "application/pdf";
}

export async function uploadReceipt(
  userId: string,
  groupId: string,
  expenseId: string,
  file: Buffer,
  mimeType: string,
): Promise<UploadReceiptResult> {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Receipt must be JPEG, PNG, WebP, or PDF.",
      [{ path: ["file"], message: `Unsupported mime type: ${mimeType}` }],
    );
  }
  if (file.byteLength > RECEIPT_MAX_BYTES) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Receipt exceeds the 10 MB size limit.",
      [{ path: ["file"], message: `File is ${file.byteLength} bytes; max is ${RECEIPT_MAX_BYTES}.` }],
    );
  }

  await assertViewerOwnsExpense(userId, groupId, expenseId);

  // Pre-process images in-memory; PDFs pass through. Per SPEC §4.8 the
  // original upload is discarded — we never persist raw input bytes.
  const isPdf = mimeType === "application/pdf";
  const processedBuffer = isPdf ? file : await preprocessImage(file);
  const processedMimeType = isPdf ? "application/pdf" : "image/webp";
  const ext = isPdf ? "pdf" : "webp";
  const storagePath = `${groupId}/${expenseId}.${ext}`;

  const supabase = getSupabaseStorageClient();
  const bucket = getReceiptsBucket();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, processedBuffer, {
      contentType: processedMimeType,
      upsert: true,
      cacheControl: "3600",
    });
  if (uploadError) {
    throw new AppError("INTERNAL_ERROR", `Failed to upload receipt: ${uploadError.message}`);
  }

  // Store the storage PATH (not a signed URL) on the expense row so the
  // record never expires. Fresh signed URLs are generated on-demand by
  // getReceiptSignedUrl() via the dedicated GET …/receipt/url endpoint.
  await prisma.expense.update({
    where: { id: expenseId },
    data: { receiptUrl: storagePath },
  });

  return {
    receiptUrl: storagePath,
    storagePath,
    processedBuffer,
    processedMimeType,
  };
}

async function preprocessImage(input: Buffer): Promise<Buffer> {
  // `withoutEnlargement` keeps small images at native size; sharp handles
  // EXIF rotation automatically when the input has orientation metadata.
  return sharp(input)
    .rotate()
    .resize({
      width: RECEIPT_LONGEST_EDGE_PX,
      height: RECEIPT_LONGEST_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
}

async function assertViewerOwnsExpense(
  userId: string,
  groupId: string,
  expenseId: string,
): Promise<void> {
  // Two checks in one query: the expense exists in the named group, and the
  // viewer is a member. Prevents a member of group A from uploading against
  // expense ids that belong to group B.
  const [membership, expense] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    }),
    prisma.expense.findUnique({
      where: { id: expenseId },
      select: { id: true, groupId: true },
    }),
  ]);

  if (!membership) {
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }
  if (!expense || expense.groupId !== groupId) {
    throw new AppError("NOT_FOUND", "Expense not found in this group.");
  }
}
