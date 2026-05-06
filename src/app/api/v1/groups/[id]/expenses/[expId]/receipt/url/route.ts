import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { getReceiptSignedUrl } from "@/server/expenses/get-receipt-url";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string; expId: string };
}

// Returns a fresh 1-hour signed URL for the expense receipt. The expense row
// stores only the storage path (set at upload time); this endpoint generates
// the short-lived signed URL on demand so stored URLs never expire.
export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  try {
    const signedUrl = await getReceiptSignedUrl(session.user.id, params.id, params.expId);
    return NextResponse.json({ signedUrl });
  } catch (err) {
    return errorFromThrown(err);
  }
}
