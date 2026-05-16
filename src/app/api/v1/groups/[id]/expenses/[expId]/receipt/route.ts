import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { extractReceiptData, persistOcrData } from "@/server/expenses/ocr-receipt";
import {
  RECEIPT_MAX_BYTES,
  uploadReceipt,
} from "@/server/expenses/upload-receipt";

export const runtime = "nodejs";
// Receipts can be up to 10MB; ensure the platform doesn't cap the body
// smaller than that. (Vercel default is 4.5MB for Edge; nodejs is higher.)
export const maxDuration = 30;

interface RouteContext {
  params: { id: string; expId: string };
}

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  const userId = session.user.id;
  if (!(await consumeRateLimit(`receipt:${userId}`, { max: 5, windowMs: 60_000 }))) {
    return errorResponse("RATE_LIMITED", "Too many receipt uploads. Try again later.", 429);
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
      [{ path: ["file"], message: "Missing file field." }],
    );
  }

  if (file.size > RECEIPT_MAX_BYTES) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Receipt exceeds the 10 MB size limit.",
      422,
      [{ path: ["file"], message: `File is ${file.size} bytes; max is ${RECEIPT_MAX_BYTES}.` }],
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const upload = await uploadReceipt(
      userId,
      params.id,
      params.expId,
      buffer,
      file.type,
    );

    // OCR runs on the processed bytes — for images this is the resized
    // WebP, for PDFs it's the original bytes. Failures here never block the
    // upload itself; the form falls back to manual entry.
    const ocr = await extractReceiptData(upload.processedBuffer);
    if (ocr.success) {
      await persistOcrData(params.expId, ocr.raw);
    }

    return NextResponse.json({
      receiptUrl: upload.receiptUrl,
      ocrData: ocr.success
        ? {
            totalAmountPaise: ocr.fields.totalAmountPaise,
            taxAmountPaise: ocr.fields.taxAmountPaise,
            merchantName: ocr.fields.merchantName,
            date: ocr.fields.date,
          }
        : null,
      ocrError: ocr.success ? null : ocr.reason,
    });
  } catch (err) {
    console.error(
      `POST /api/v1/groups/${params.id}/expenses/${params.expId}/receipt failed`,
      err,
    );
    return errorFromThrown(err);
  }
}
