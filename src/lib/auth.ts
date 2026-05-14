import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";

import authEdgeConfig from "@/lib/auth-edge";
import { prisma } from "@/lib/prisma";
import { loginSchema, verifyEmailOtpSchema } from "@/lib/validations/auth";
import { dummyVerifyPassword, hashPassword, verifyPassword } from "@/server/auth/password";
import { OTP_TTL_MS, verifyEmailOtp } from "@/server/auth/email-otp";
import {
  clearRateLimit,
  consumeRateLimit,
  getClientIp,
} from "@/server/auth/rate-limit";
import { sendMagicLinkEmail } from "@/server/email/auth-emails";
import { hashToken } from "@/server/auth/tokens";
import { upsertUser } from "@/server/auth/upsert-user";
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

// Surface missing SMTP config at server start so magic-link sends don't fail
// silently with a generic "couldn't send" downstream. Logs once per process.
const missingSmtpEnv = (
  ["BREVO_SMTP_HOST", "BREVO_SMTP_PORT", "BREVO_SMTP_USER", "BREVO_SMTP_PASS"] as const
).filter((key) => !process.env[key]);
if (missingSmtpEnv.length > 0) {
  console.warn(
    `[auth] Missing SMTP env vars: ${missingSmtpEnv.join(", ")}. Magic-link emails will fail.`,
  );
}

// PrismaAdapter is needed by the Nodemailer (magic-link) provider for the
// VerificationToken table. We override `createUser` so the adapter funnels
// new users through upsertUser instead of doing its own prisma.user.create —
// otherwise the adapter would attempt to insert a row without a `handle`,
// and the @unique handle column has no default. upsertUser is the single
// source of truth for creating User rows (CLAUDE.md auth-rules).
//
// `prisma` is a Proxy (see src/lib/prisma.ts) so calling PrismaAdapter at
// module load no longer triggers DB initialization or the DATABASE_URL
// check — connection happens lazily on first query.
const baseAdapter = PrismaAdapter(prisma);
const adapter: typeof baseAdapter = {
  ...baseAdapter,
  createUser: async (data) => {
    const u = await upsertUser({
      email: data.email,
      name: data.name ?? null,
      image: data.image ?? null,
      // The adapter only ever runs for the magic-link path in this app
      // (Credentials provider and Google JWT-strategy don't go through it
      // for create). Marking the row verified is correct: the user just
      // proved inbox ownership by clicking the link.
      provider: "magic-link",
      emailVerified: true,
    });
    return {
      id: u.id,
      email: u.email ?? "",
      emailVerified: u.emailVerifiedAt,
      name: u.displayName,
      image: u.avatarUrl,
    };
  },

  // NextAuth's PrismaAdapter passes { identifier, token, expires } but our
  // VerificationToken schema stores only tokenHash (SHA-256 of the raw token
  // so a DB snapshot doesn't yield active links) and requires a purpose field.
  // Magic-link is the only NextAuth flow that calls this method, so we
  // hardcode EMAIL_VERIFICATION. Upsert so re-sending a link supersedes the
  // previous one without leaving a dangling row.
  createVerificationToken: async ({ identifier, token, expires }) => {
    const tokenHash = hashToken(token);
    await prisma.verificationToken.upsert({
      where: {
        identifier_purpose: { identifier, purpose: "EMAIL_VERIFICATION" },
      },
      create: { identifier, tokenHash, purpose: "EMAIL_VERIFICATION", expires },
      update: { tokenHash, expires, createdAt: new Date() },
    });
    // Return the raw token — NextAuth embeds it in the sign-in URL, not the hash.
    return { identifier, token, expires };
  },

  // Called when the user clicks the magic-link. Look up by hash (the raw token
  // is in the URL), delete on first use (single-use guarantee), and return the
  // shape NextAuth expects. Returns null if the token is missing, expired, or
  // already consumed — NextAuth surfaces these as a generic "link invalid" page.
  useVerificationToken: async ({ identifier, token }) => {
    const tokenHash = hashToken(token);
    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash },
      select: { identifier: true, expires: true },
    });
    if (!record || record.identifier !== identifier) return null;
    // Best-effort delete — if a concurrent click already consumed it, treat as
    // already used (return null) rather than crashing.
    try {
      await prisma.verificationToken.delete({ where: { tokenHash } });
    } catch {
      return null;
    }
    return { identifier, token, expires: record.expires };
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  ...authEdgeConfig,
  adapter,
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
        try {
          await sendMagicLinkEmail({
            to: identifier,
            signInUrl: url,
            ttlMinutes,
          });
          // Per the bug report: confirm send succeeded without logging the
          // recipient address or the single-use URL.
          console.log("Email sent successfully");
        } catch (err) {
          // Surface the underlying SMTP failure so "couldn't send" has a
          // root cause to grep for. NextAuth swallows the message otherwise.
          console.error("Magic link send failed:", {
            error: err instanceof Error ? err.message : String(err),
            code: (err as { code?: string } | null)?.code,
            command: (err as { command?: string } | null)?.command,
            response: (err as { response?: string } | null)?.response,
            host: process.env.BREVO_SMTP_HOST,
            port: process.env.BREVO_SMTP_PORT,
            user: process.env.BREVO_SMTP_USER,
            hasPassword: !!process.env.BREVO_SMTP_PASS,
            fromEmail: process.env.BREVO_FROM_EMAIL,
            fromName: process.env.BREVO_FROM_NAME,
          });
          throw err;
        }
      },
    }),
    Credentials({
      id: "credentials",
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
          //
          // This is intentionally NOT routed through upsertUser — it's a
          // password-attach on an EXISTING row, not a new user. upsertUser
          // would treat it as an unrelated update.
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
    Credentials({
      // Second CredentialsProvider — distinct id "otp" so it doesn't collide
      // with the password-based one above. The OTP flow signs the user in
      // through NextAuth so the same JWT/session machinery is shared with
      // every other provider — no bespoke session creation.
      id: "otp",
      name: "OTP",
      credentials: {
        email: { type: "email" },
        otp: { type: "text" },
      },
      async authorize(rawCredentials, request) {
        const parsed = verifyEmailOtpSchema.safeParse({
          email: rawCredentials?.email,
          code: rawCredentials?.otp,
        });
        if (!parsed.success) return null;
        const { email, code } = parsed.data;

        // Same brute-force defense the OTP server actions enforced —
        // per-email AND per-IP buckets sized to the 15-min OTP window so a
        // single attacker can't share rate budget by switching one of the
        // two. Kept at 10/15min on the email key per SPEC §2.1 ratio.
        const ip = getClientIp(request);
        if (!consumeRateLimit(`otp-verify:${email}`, { max: 10, windowMs: OTP_TTL_MS })) {
          return null;
        }
        if (!consumeRateLimit(`otp-verify-ip:${ip}`, { max: 30, windowMs: OTP_TTL_MS })) {
          return null;
        }

        // verifyEmailOtp handles expiry, timingSafeEqual on the salted hash,
        // and single-use deletion atomically. No further state needs to be
        // managed here.
        const result = await verifyEmailOtp({ email, code });
        if (!result.ok) return null;

        const u = await upsertUser({
          email,
          provider: "otp",
          emailVerified: true,
        });
        if (u.deletedAt) return null;

        return {
          id: u.id,
          handle: u.handle,
          email: u.email,
          name: u.displayName,
          image: u.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    ...authEdgeConfig.callbacks,
    async signIn({ user, account, profile }) {
      // Both OAuth (Google) and magic-link (Nodemailer) flows pass through
      // here AFTER the adapter has run. We re-call upsertUser as the
      // single source of truth — it's idempotent on existing rows and
      // backfills emailVerifiedAt / displayName / avatar when needed.
      // Credentials and OTP flows already created/looked up the user
      // inside their authorize() and don't need this branch.
      const provider = account?.provider;
      if (provider !== "google" && provider !== "nodemailer") return true;

      const email = user.email ?? profile?.email ?? null;
      if (!email) return false;

      const upsertProvider = provider === "google" ? "google" : "magic-link";
      const dbUser = await upsertUser({
        email,
        name: user.name ?? profile?.name ?? null,
        image:
          user.image ?? (typeof profile?.picture === "string" ? profile.picture : null),
        provider: upsertProvider,
        emailVerified: true,
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