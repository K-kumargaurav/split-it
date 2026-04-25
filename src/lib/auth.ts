import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";

import authEdgeConfig from "@/lib/auth-edge";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { dummyVerifyPassword, verifyPassword } from "@/server/auth/password";
import { upsertOAuthUser } from "@/server/auth/oauth";
import {
  clearRateLimit,
  consumeRateLimit,
  getClientIp,
} from "@/server/auth/rate-limit";
import "@/types/auth";

// Distinct error codes propagate to the client (via signIn result.error / URL
// ?error=...) so the login form can show a "verify your email" CTA when the
// password was correct but the email is unverified.
class EmailNotVerifiedError extends CredentialsSignin {
  code = "EmailNotVerified";
}

// Brevo SMTP — mirrors the transactional pipeline. Port 465 = TLS, otherwise
// STARTTLS (Brevo's 587 path). Defined here (Node runtime only) so nodemailer
// is never pulled into the edge bundle.
const brevoPort = Number.parseInt(process.env.BREVO_SMTP_PORT ?? "587", 10);
const brevoFrom = process.env.BREVO_FROM_NAME
  ? `${process.env.BREVO_FROM_NAME} <${process.env.BREVO_FROM_EMAIL ?? ""}>`
  : process.env.BREVO_FROM_EMAIL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authEdgeConfig,
  // The Nodemailer (magic-link) provider stores single-use tokens via the
  // adapter. Keep this on the Node-side config — the Prisma adapter must not
  // be bundled into the edge middleware.
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authEdgeConfig.providers,
    Nodemailer({
      server: {
        host: process.env.BREVO_SMTP_HOST,
        port: brevoPort,
        secure: brevoPort === 465,
        auth: {
          user: process.env.BREVO_SMTP_USER,
          pass: process.env.BREVO_SMTP_PASS,
        },
      },
      from: brevoFrom,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const ip = getClientIp(request);
        const rateKey = `login:${parsed.data.email}:${ip}`;
        if (!consumeRateLimit(rateKey)) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            passwordHash: true,
            emailVerifiedAt: true,
            deletedAt: true,
          },
        });
        if (!user || user.deletedAt || !user.passwordHash) {
          await dummyVerifyPassword(parsed.data.password);
          return null;
        }

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        if (!user.emailVerifiedAt) {
          // Password was correct but email isn't verified. Reject with a
          // distinct code so the UI can prompt to resend the verification
          // link instead of showing a generic "invalid credentials" error.
          throw new EmailNotVerifiedError();
        }

        clearRateLimit(rateKey);

        return {
          id: user.id,
          handle: user.handle,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    ...authEdgeConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const email = user.email ?? profile?.email ?? null;
      if (!email) return false;

      const dbUser = await upsertOAuthUser({
        email,
        name: user.name ?? profile?.name ?? null,
        image: user.image ?? (typeof profile?.picture === "string" ? profile.picture : null),
      });
      if (dbUser.deletedAt) return false;

      user.id = dbUser.id;
      user.handle = dbUser.handle;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id && user.handle) {
        token.id = user.id;
        token.handle = user.handle;
        return token;
      }
      const userId = token.id ?? token.sub;
      if (!token.handle && userId) {
        const fresh = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, handle: true },
        });
        if (fresh) {
          token.id = fresh.id;
          token.handle = fresh.handle;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.handle = token.handle;
      }
      return session;
    },
  },
});
