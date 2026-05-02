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

// Exported so route handlers can generate one ID at the top of each handler
// and pass it to every errorResponse / errorFromThrown call in that request.
// This binds all error envelopes from the same request to a single traceable
// ID, making it possible to correlate the client-visible requestId with logs.
//
// Usage pattern in a route:
//   const reqId = generateRequestId(request);
//   ...
//   return errorResponse("NOT_FOUND", "Not found.", 404, undefined, reqId);
//   return errorFromThrown(err, reqId);
export function generateRequestId(source?: Request | string): string {
  if (typeof source === "string") return source;
  if (source instanceof Request) {
    // Prefer platform-injected headers so the ID matches what the edge logged.
    const vercelId = source.headers.get("x-vercel-id");
    if (vercelId) return vercelId;
    const existingId = source.headers.get("x-request-id");
    if (existingId) return existingId;
  }
  return makeRequestId();
}

export function errorResponse(
  code: AppErrorCode,
  message: string,
  status: number,
  details?: AppErrorIssue[],
  requestId?: string,
): NextResponse<ErrorEnvelope> {
  const body: ErrorEnvelope = {
    error: { code, message, ...(details ? { details } : {}) },
    requestId: requestId ?? makeRequestId(),
  };
  return NextResponse.json(body, { status });
}

// Maps any thrown value to the standard envelope. AppError carries code +
// status; everything else collapses to a generic 500 with a request-traceable
// id (the underlying error is logged by the caller).
export function errorFromThrown(err: unknown, requestId?: string): NextResponse<ErrorEnvelope> {
  if (err instanceof AppError) {
    return errorResponse(err.code, err.message, err.status, err.details, requestId);
  }
  return errorResponse("INTERNAL_ERROR", "Something went wrong.", 500, undefined, requestId);
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
