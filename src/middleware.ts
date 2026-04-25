import NextAuth from "next-auth";

import authEdgeConfig from "@/lib/auth-edge";

// Middleware runs on the edge runtime. It MUST import the edge-only config —
// the full config in `@/lib/auth` pulls in nodemailer, bcrypt, and the Prisma
// client, none of which are edge-compatible.
export const { auth: middleware } = NextAuth(authEdgeConfig);

export default middleware;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/groups/:path*",
    "/api/v1/:path*",
  ],
};
