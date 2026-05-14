import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authEdgeConfig from "@/lib/auth-edge";

// Middleware runs on the edge runtime. It MUST import the edge-only config —
// the full config in `@/lib/auth` pulls in nodemailer, bcrypt, and the Prisma
// client, none of which are edge-compatible.
const { auth } = NextAuth({
  ...authEdgeConfig,
  secret: process.env.AUTH_SECRET,
});

// /register is intentionally excluded: an authenticated user must be able to
// remain on /register while the profile-setup screen is displayed (which is
// rendered client-side after OTP verification, before any navigation away).
const AUTH_PAGES = new Set(["/login"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Already-signed-in users should never see the login page — bounce them to
  // the dashboard. /register is excluded so profile setup can complete first.
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
