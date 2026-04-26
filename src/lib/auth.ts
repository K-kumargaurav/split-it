import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";

import authEdgeConfig from "@/lib/auth-edge";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { dummyVerifyPassword, hashPassword, verifyPassword } from "@/server/auth/password";
import { upsertOAuthUser } from "@/server/auth/oauth";
import {
  clearRateLimit,
  consumeRateLimit,
  getClientIp,
} from "@/server/auth/rate-limit";
import { sendMagicLinkEmail } from "@/server/email/auth-emails";
import "@/types/auth";

// Distinct error codes propagate to the client (via signIn result.error / URL
// ?error=...) so the login form can show a "verify your email" CTA when the
// password was correct but the email is unverified.
class EmailNotVerifiedError extends CredentialsSignin {
  code = "EmailNotVerified";
}

// Thrown when no User exists for the given email. The UI maps this to a
// "No account found — create one?" prompt with a link to /register, instead
// of showing "Incorrect password" (which would imply an account exists).
//
// Note: this distinguishes "no account" from "wrong password" via error
// code, which is an account-enumeration tradeoff. Accepted per the
// flexible-sign-in spec — email is the single source of identity, so the
// system already reveals registration state through the linking flows.
class AccountNotFoundError extends CredentialsSignin {
  code = "AccountNotFound";
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
      // Custom sender so the magic-link email matches the rest of our
      // transactional mail (branded HTML, BREVO_FROM_EMAIL/NAME via the
      // shared sendMail client). Without this, NextAuth's default sender
      // emits a plaintext stub that doesn't go through our Brevo client.
      async sendVerificationRequest({ identifier, url, expires }) {
        const ttlMinutes = Math.max(
          1,
          Math.round((expires.getTime() - Date.now()) / 60_000),
        );
        await sendMagicLinkEmail({
          to: identifier,
          signInUrl: url,
          ttlMinutes,
        });
        // Per the bug report: confirm send succeeded without logging the
        // recipient address or the single-use URL.
        console.log("Email sent successfully");
      },
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
        if (!user || user.deletedAt) {
          // Burn a dummy bcrypt compare to keep timing close to the
          // password-verify path before signalling "no account".
          await dummyVerifyPassword(parsed.data.password);
          throw new AccountNotFoundError();
        }

        if (!user.passwordHash) {
          // Account exists but has no password — registered via Google or
          // magic link. Per the flexible-sign-in spec: silently attach the
          // submitted password as the account's first password and sign
          // them in. There is nothing to "verify" against, so any password
          // they enter becomes the account password.
          //
          // Tradeoff: this lets anyone who knows a Google-only user's
          // email set a password without first proving inbox ownership.
          // Mitigations elsewhere: Google sign-in still works untouched,
          // and the user can use /forgot-password to overwrite the
          // attacker-set password from their inbox.
          const newHash = await hashPassword(parsed.data.password);
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newHash },
          });
          user.passwordHash = newHash;
        } else {
          const ok = await verifyPassword(parsed.data.password, user.passwordHash);
          if (!ok) return null;
        }

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
