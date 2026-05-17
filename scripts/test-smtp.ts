/**
 * Quick SMTP connectivity test. Run with:
 *   npx tsx scripts/test-smtp.ts
 *
 * Tests that Brevo credentials work and the FROM email is accepted.
 */
import "dotenv/config";
import nodemailer from "nodemailer";

const host = process.env.BREVO_SMTP_HOST!;
const port = Number(process.env.BREVO_SMTP_PORT!);
const user = process.env.BREVO_SMTP_USER!;
const pass = process.env.BREVO_SMTP_PASS!;
const fromEmail = process.env.BREVO_FROM_EMAIL!;
const fromName = process.env.BREVO_FROM_NAME!;

console.log("SMTP Config:");
console.log(`  Host: ${host}`);
console.log(`  Port: ${port}`);
console.log(`  User: ${user}`);
console.log(`  From: ${fromName} <${fromEmail}>`);
console.log("");

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: port !== 465,
  auth: { user, pass },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

async function main() {
  console.log("1. Verifying SMTP connection...");
  try {
    await transporter.verify();
    console.log("   OK — connected and authenticated.\n");
  } catch (err) {
    console.error("   FAILED —", (err as Error).message);
    console.error("\n   Possible causes:");
    console.error("   - BREVO_SMTP_USER or BREVO_SMTP_PASS is wrong");
    console.error("   - Port 587 is blocked by your network/firewall");
    console.error("   - Brevo account SMTP is not activated");
    process.exit(1);
  }

  console.log("2. Sending test email to yourself...");
  const testTo = fromEmail; // send to yourself
  try {
    const info = await transporter.sendMail({
      from: { name: fromName, address: fromEmail },
      to: testTo,
      subject: "SplitEasy SMTP Test",
      text: "If you received this, your SMTP setup is working correctly.",
      html: "<p>If you received this, your SMTP setup is <strong>working correctly</strong>.</p>",
    });
    console.log(`   OK — Message accepted. ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    console.log(`\n   Check ${testTo} inbox (and spam folder).`);
  } catch (err) {
    const e = err as { message: string; responseCode?: number; response?: string };
    console.error("   FAILED —", e.message);
    if (e.responseCode || e.response) {
      console.error(`   SMTP response: [${e.responseCode}] ${e.response}`);
    }
    console.error("\n   Possible causes:");
    console.error("   - BREVO_FROM_EMAIL is not a verified sender in Brevo");
    console.error("   - The sender domain is not authenticated in Brevo");
    console.error("   - Using @gmail.com as FROM — change to your own domain");
    process.exit(1);
  }
}

main();
