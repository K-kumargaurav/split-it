import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { AppError, type AppErrorCode, type AppErrorIssue } from "@/lib/errors";

// Standard error envelope from SPEC §6.0:
//   { error: { code, message, details? }, requestId }
// `details` is only set on 422 (validation) per spec.

interface ErrorEnvelope {
  error: {
    code: AppErrorCode;
    message: string;
    details?: AppErrorIssue[];
  };
  requestId: string;
}

function makeRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

export function errorResponse(
  code: AppErrorCode,
  message: string,
  status: number,
  details?: AppErrorIssue[],
): NextResponse<ErrorEnvelope> {
  const body: ErrorEnvelope = {
    error: { code, message, ...(details ? { details } : {}) },
    requestId: makeRequestId(),
  };
  return NextResponse.json(body, { status });
}

// Maps any thrown value to the standard envelope. AppError carries code +
// status; everything else collapses to a generic 500 with a request-traceable
// id (the underlying error is logged by the caller).
export function errorFromThrown(err: unknown): NextResponse<ErrorEnvelope> {
  if (err instanceof AppError) {
    return errorResponse(err.code, err.message, err.status, err.details);
  }
  return errorResponse("INTERNAL_ERROR", "Something went wrong.", 500);
}

// JSON has no native bigint, and `Number(b)` silently rounds anything
// over 2^53 — for paise that's roughly ₹90 trillion, but the loss starts
// well before that for numbers used in arithmetic. Always serialize paise
// as a string at the API boundary and parse it back on the client.
//
// CLAUDE.md: "ALWAYS store money as integers (paise/cents) — NEVER floats".
// This helper is the chokepoint that keeps the wire format honest about
// that — strings are exact regardless of magnitude.
export function serializePaise(b: bigint): string {
  return b.toString();
}
