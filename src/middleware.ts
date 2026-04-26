import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authEdgeConfig from "@/lib/auth-edge";

// Middleware runs on the edge runtime. It MUST import the edge-only config —
// the full config in `@/lib/auth` pulls in nodemailer, bcrypt, and the Prisma
// client, none of which are edge-compatible.
const { auth } = NextAuth(authEdgeConfig);

const AUTH_PAGES = new Set(["/login", "/register"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Already-signed-in users should never see the login or register pages —
  // bounce them to the dashboard so they can't accidentally re-trigger an
  // auth flow that recreates a session for the same identity.
  if (req.auth?.user && AUTH_PAGES.has(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // For every other matched path, fall through to the default `authorized`
  // callback in authEdgeConfig (which gates /dashboard, /groups, /api/v1).
  return undefined;
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/groups/:path*",
    "/api/v1/:path*",
    "/login",
    "/register",
  ],
};
