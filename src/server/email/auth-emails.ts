import { sendMail } from "@/server/email/client";
import {
  renderPasswordResetEmail,
  renderVerificationEmail,
} from "@/server/email/templates";

function getAppUrl(): string {
  const url = process.env.APP_URL ?? process.env.NEXTAUTH_URL;
  if (!url) {
    throw new Error("APP_URL (or NEXTAUTH_URL) is not set");
  }
  return url.replace(/\/+$/, "");
}

interface SendVerificationInput {
  to: string;
  displayName: string;
  rawToken: string;
}

export async function sendVerificationEmail(input: SendVerificationInput): Promise<void> {
  const verifyUrl = `${getAppUrl()}/verify-email?token=${encodeURIComponent(input.rawToken)}`;
  const rendered = renderVerificationEmail({
    verifyUrl,
    displayName: input.displayName,
  });
  await sendMail({
    to: input.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}

interface SendPasswordResetInput {
  to: string;
  displayName: string;
  rawToken: string;
}

export async function sendPasswordResetEmail(input: SendPasswordResetInput): Promise<void> {
  const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(input.rawToken)}`;
  const rendered = renderPasswordResetEmail({
    resetUrl,
    displayName: input.displayName,
  });
  await sendMail({
    to: input.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}
