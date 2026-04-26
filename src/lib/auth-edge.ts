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

export const authEdgeConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 15 },
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
