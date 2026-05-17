import nodemailer, { type Transporter } from "nodemailer";

interface BrevoEnv {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

function readBrevoEnv(): BrevoEnv {
  const host = process.env.BREVO_SMTP_HOST;
  const portRaw = process.env.BREVO_SMTP_PORT;
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME;
  if (!host || !portRaw || !user || !pass || !fromEmail || !fromName) {
    throw new Error(
      "Missing Brevo SMTP env vars (BREVO_SMTP_HOST/PORT/USER/PASS, BREVO_FROM_EMAIL, BREVO_FROM_NAME)",
    );
  }
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`BREVO_SMTP_PORT is not a valid number: ${portRaw}`);
  }
  return { host, port, user, pass, fromEmail, fromName };
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  const env = readBrevoEnv();
  cachedTransporter = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    // Brevo uses STARTTLS on 587 (secure: false + requireTLS) and TLS on 465.
    secure: env.port === 465,
    requireTLS: env.port !== 465,
    auth: { user: env.user, pass: env.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return cachedTransporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const env = readBrevoEnv();
  const transporter = getTransporter();
  await transporter.sendMail({
    from: { name: env.fromName, address: env.fromEmail },
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export const __testing = {
  reset(): void {
    cachedTransporter = null;
  },
};
