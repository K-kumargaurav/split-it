import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import Google from "next-auth/providers/google";

import "@/types/auth";

// Edge-safe NextAuth config used by middleware.ts. Must not import any
// Node-only module (nodemailer, bcrypt, the Prisma client, etc.) — Auth.js v5
// requires the middleware-bound config to be edge-compatible.
//
// The full config (Credentials, Nodemailer, Prisma adapter) lives in
// `src/lib/auth.ts` and runs on the Node.js runtime via the API route handler.

const PROTECTED_PREFIXES = ["/dashboard", "/groups", "/api/v1"];

// Routes under /api/v1/* (and /api/guest/*) that must remain reachable WITHOUT
// a session: NextAuth's own callback handlers, cron jobs (auth'd via shared
// CRON_SECRET), invite-acceptance lookups (the user is authenticating right
// now), and the public guest-view endpoints (auth'd via per-ghost guestToken).
const PUBLIC_PREFIXES = [
  "/api/v1/auth/",
  "/api/v1/internal/cron/",
  "/api/v1/invites/accept",
  "/api/guest/",
  "/api/debug",
];

export const authEdgeConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  // 7-day rolling JWT session. The original 15-min maxAge logged users out
  // mid-task because there was no refresh token mechanism wired — every
  // session was effectively single-use. NextAuth refreshes the JWT on each
  // request automatically, so this gives a real "stay signed in for the
  // week" experience without coupling to a separate RefreshToken table.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Email is the single source of identity in this app: a user who
      // registered with email+password (or magic link) can later "Continue
      // with Google" and the OAuth account is linked to the existing user
      // instead of NextAuth throwing OAuthAccountNotLinked. Safe with Google
      // because Google guarantees the email is verified on its side.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      const isPublic = PUBLIC_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix),
      );
      if (isPublic) return true;
      const isProtected = PROTECTED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      );
      if (!isProtected) return true;
      if (session?.user) return true;

      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return false;
    },
  },
} satisfies NextAuthConfig;

export default authEdgeConfig;
