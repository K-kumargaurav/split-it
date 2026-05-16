import { NextResponse } from "next/server";
import sharp from "sharp";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { extractReceiptData } from "@/server/expenses/ocr-receipt";
import { RECEIPT_MAX_BYTES } from "@/server/expenses/upload-receipt";
import { consumeRateLimit } from "@/server/auth/rate-limit";

// OCR-only preview for the "new expense" form. The user hasn't created the
// expense yet, so we can't write to storage; we just OCR the bytes in
// memory and return the extracted fields. The actual file upload happens
// after the expense is saved, via /expenses/:expId/receipt.

export const runtime = "nodejs";
export const maxDuration = 30;

interface RouteContext {
  params: { id: string };
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: session.user.id } },
    select: { id: true },
  });
  if (!membership) {
    return errorResponse("FORBIDDEN", "You don't have access to this group.", 403);
  }

  // 10 OCR requests per minute per user — caps Google Vision API spend and
  // prevents memory exhaustion from concurrent sharp re-encodes.
  if (!(await consumeRateLimit(`ocr:${session.user.id}`, { max: 10, windowMs: 60_000 }))) {
    return errorResponse("RATE_LIMITED", "Too many OCR requests. Please wait a minute.", 429);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid multipart body.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Receipt file is required (form field: 'file').",
      422,
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Receipt must be JPEG, PNG, WebP, or PDF.",
      422,
    );
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Receipt exceeds the 10 MB size limit.",
      422,
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    // Pre-process images for OCR identically to the upload path so the
    // pre-fill values match what the saved receipt will produce.
    const ocrInput =
      file.type === "application/pdf"
        ? buffer
        : await sharp(buffer)
            .rotate()
            .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();

    const result = await extractReceiptData(ocrInput);
    return NextResponse.json({
      ocrData: result.success
        ? {
            totalAmountPaise: result.fields.totalAmountPaise,
            taxAmountPaise: result.fields.taxAmountPaise,
            merchantName: result.fields.merchantName,
            date: result.fields.date,
          }
        : null,
      ocrError: result.success ? null : result.reason,
    });
  } catch (err) {
    console.error(`POST /api/v1/groups/${params.id}/receipt-ocr-preview failed`, err);
    return errorFromThrown(err);
  }
}
