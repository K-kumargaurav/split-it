import { NextResponse } from "next/server";

import { requestMagicLink } from "@/server/auth/magic-link";

export const runtime = "nodejs";

// Wraps the server-side magic-link send so the client form can fetch() it
// rather than importing `@/server/auth/magic-link` directly. Importing a
// server module into a "use client" component pulls nodemailer / Prisma /
// crypto into the browser bundle and trips the
// `__webpack_require__.n is not a function` error at runtime.
export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        formError: "Invalid request.",
      },
      { status: 400 },
    );
  }

  const result = await requestMagicLink(raw);
  // Always 200: the result object carries `ok` + error detail, mirroring
  // the previous server-action return shape so the form needs no logic
  // change beyond the transport.
  return NextResponse.json(result);
}
