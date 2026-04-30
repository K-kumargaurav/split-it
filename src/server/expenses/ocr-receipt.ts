import { prisma } from "@/lib/prisma";
import { rupeesToPaise } from "@/lib/format";

// Google Cloud Vision DOCUMENT_TEXT_DETECTION via the JSON REST API. We use
// fetch + the API-key endpoint (not the gRPC client) so the only thing this
// module needs is GOOGLE_CLOUD_VISION_API_KEY — no service-account JSON,
// no application default credentials. This is server-only (SPEC §4.8).
//
// On any error or 10s timeout the caller gets `{ success: false }` and the
// expense form falls back to manual entry.

export const OCR_TIMEOUT_MS = 10_000;
const OCR_CONFIDENCE_THRESHOLD = 0.8;
const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

export interface OcrFields {
  totalAmountPaise: number | null;
  taxAmountPaise: number | null;
  merchantName: string | null;
  date: string | null; // ISO yyyy-mm-dd
}

export type OcrResult =
  | { success: true; fields: OcrFields; raw: unknown }
  | { success: false; reason: "TIMEOUT" | "NO_TEXT" | "API_ERROR" | "NOT_CONFIGURED" };

interface VisionPage {
  blocks?: VisionBlock[];
  confidence?: number;
}

interface VisionBlock {
  paragraphs?: VisionParagraph[];
  confidence?: number;
}

interface VisionParagraph {
  words?: VisionWord[];
  confidence?: number;
}

interface VisionWord {
  symbols?: { text?: string; property?: { detectedBreak?: { type?: string } } }[];
  confidence?: number;
}

interface VisionResponse {
  responses?: {
    fullTextAnnotation?: {
      text?: string;
      pages?: VisionPage[];
    };
    error?: { code?: number; message?: string };
  }[];
}

export async function extractReceiptData(imageBuffer: Buffer): Promise<OcrResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return { success: false, reason: "NOT_CONFIGURED" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${VISION_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBuffer.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { success: false, reason: "TIMEOUT" };
    }
    return { success: false, reason: "API_ERROR" };
  }
  clearTimeout(timer);

  if (!response.ok) return { success: false, reason: "API_ERROR" };

  let json: VisionResponse;
  try {
    json = (await response.json()) as VisionResponse;
  } catch {
    return { success: false, reason: "API_ERROR" };
  }

  const result = json.responses?.[0];
  if (!result || result.error) return { success: false, reason: "API_ERROR" };
  const fullText = result.fullTextAnnotation?.text ?? "";
  if (!fullText.trim()) return { success: false, reason: "NO_TEXT" };

  const overallConfidence = computeAverageConfidence(result.fullTextAnnotation?.pages);
  const fields = extractFields(fullText, overallConfidence);

  return { success: true, fields, raw: json };
}

// Persists the raw Vision response on the expense for future debugging. Kept
// separate from `extractReceiptData` so the caller can decide whether to
// store partial/failed results — typically only success cases.
export async function persistOcrData(expenseId: string, raw: unknown): Promise<void> {
  await prisma.expense.update({
    where: { id: expenseId },
    data: { ocrData: raw as object },
  });
}

function computeAverageConfidence(pages: VisionPage[] | undefined): number {
  if (!pages || pages.length === 0) return 0;
  const values: number[] = [];
  for (const p of pages) {
    if (typeof p.confidence === "number") values.push(p.confidence);
    for (const b of p.blocks ?? []) {
      if (typeof b.confidence === "number") values.push(b.confidence);
    }
  }
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// Heuristic field extraction over plain text. Confidence is the document-
// level average from Vision; below the threshold, individual fields are
// returned as null per the task spec ("If confidence < 0.8 return null").
function extractFields(text: string, confidence: number): OcrFields {
  const totalRupees = findTotalAmountRupees(text);
  const taxRupees = findTaxAmountRupees(text);
  const merchant = findMerchantName(text);
  const date = findDate(text);

  const passes = confidence >= OCR_CONFIDENCE_THRESHOLD;
  return {
    totalAmountPaise: passes && totalRupees !== null ? toPaise(totalRupees) : null,
    taxAmountPaise: passes && taxRupees !== null ? toPaise(taxRupees) : null,
    merchantName: passes ? merchant : null,
    date: passes ? date : null,
  };
}

// OCR captures the rupee amount as a string ("1234.50") so we can route it
// through the shared `rupeesToPaise` (BigInt path) without going through a
// JS number. We collapse the BigInt to Number for the OcrFields shape; the
// per-receipt cap is well under MAX_SAFE_INTEGER.
function toPaise(rupeeString: string): number | null {
  try {
    return Number(rupeesToPaise(rupeeString));
  } catch {
    return null;
  }
}

const TOTAL_KEYWORDS = ["grand total", "total amount", "amount due", "net payable", "total"];
const TAX_KEYWORDS = ["gst", "cgst", "sgst", "igst", "tax", "vat"];
const DATE_REGEXES = [
  /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/, // 2026-04-29 or 2026/4/29
  /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/, // 29-04-2026, 29/04/26
];

function findTotalAmountRupees(text: string): string | null {
  return findKeyedAmount(text, TOTAL_KEYWORDS);
}
function findTaxAmountRupees(text: string): string | null {
  return findKeyedAmount(text, TAX_KEYWORDS);
}

// Looks for a line like "Total ₹1,234.50" — accepts the keyword anywhere on
// the line and grabs the LAST numeric token on that line as the amount,
// since receipts often print "Subtotal | Tax | Total" with the value at end.
// Returns the raw rupee string (commas stripped) so the caller can convert
// to paise via integer/BigInt math without an IEEE-754 round-trip.
function findKeyedAmount(text: string, keywords: string[]): string | null {
  const lines = text.split(/\r?\n/);
  for (const keyword of keywords) {
    for (const line of lines) {
      if (line.toLowerCase().includes(keyword)) {
        const matches = line.match(/[\d,]+(?:\.\d{1,2})?/g);
        if (matches && matches.length > 0) {
          const last = matches[matches.length - 1]!.replace(/,/g, "");
          if (/^\d+(\.\d{1,2})?$/.test(last) && Number(last) > 0) return last;
        }
      }
    }
  }
  return null;
}

function findMerchantName(text: string): string | null {
  // Heuristic: first non-empty line that is mostly letters and not a date
  // or amount header. Receipt headers are nearly always the merchant name.
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[\d\s\-/.,:]+$/.test(line)) continue; // pure digits/punct
    if (line.length < 2 || line.length > 80) continue;
    return line;
  }
  return null;
}

function findDate(text: string): string | null {
  for (const re of DATE_REGEXES) {
    const m = text.match(re);
    if (!m) continue;
    if (re === DATE_REGEXES[0]) {
      const [, y, mo, d] = m;
      return formatIso(Number(y), Number(mo), Number(d));
    }
    const [, d, mo, yRaw] = m;
    const year = yRaw!.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    return formatIso(year, Number(mo), Number(d));
  }
  return null;
}

function formatIso(year: number, month: number, day: number): string | null {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
