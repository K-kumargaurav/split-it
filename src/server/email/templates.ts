// Plaintext + HTML bodies for transactional auth emails. Inline styles only —
// most clients strip <style> blocks. No images so the email renders even with
// remote content blocked. Links use the raw token in the URL; only the hash is
// stored server-side.

interface VerificationEmailInput {
  verifyUrl: string;
  displayName: string;
}

export function renderVerificationEmail(input: VerificationEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Verify your SplitEasy email";
  const text = `Hi ${input.displayName},

Welcome to SplitEasy! Please verify your email address by clicking the link below (valid for 24 hours):

${input.verifyUrl}

If you did not create a SplitEasy account, you can ignore this message.
`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
        <tr><td>
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#0f172a;">Verify your email</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#334155;">Hi ${escapeHtml(input.displayName)}, welcome to SplitEasy. Confirm your email address to start splitting expenses with your group.</p>
          <p style="margin:0 0 24px;">
            <a href="${escapeHtmlAttr(input.verifyUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;">Verify email</a>
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#64748b;">This link expires in 24 hours.</p>
          <p style="margin:0 0 8px;font-size:12px;color:#64748b;">Or paste this URL into your browser:</p>
          <p style="margin:0 0 16px;font-size:12px;color:#475569;word-break:break-all;">${escapeHtml(input.verifyUrl)}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
          <p style="margin:0;font-size:12px;color:#94a3b8;">If you did not create a SplitEasy account, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}

interface PasswordResetEmailInput {
  resetUrl: string;
  displayName: string;
}

export function renderPasswordResetEmail(input: PasswordResetEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Reset your SplitEasy password";
  const text = `Hi ${input.displayName},

We received a request to reset your SplitEasy password. Use the link below to choose a new one (valid for 1 hour):

${input.resetUrl}

If you did not request this, you can ignore this message — your password will stay the same.
`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
        <tr><td>
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#0f172a;">Reset your password</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#334155;">Hi ${escapeHtml(input.displayName)}, we received a request to reset your SplitEasy password. Click the button below to choose a new one.</p>
          <p style="margin:0 0 24px;">
            <a href="${escapeHtmlAttr(input.resetUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;">Reset password</a>
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#64748b;">This link expires in 1 hour.</p>
          <p style="margin:0 0 8px;font-size:12px;color:#64748b;">Or paste this URL into your browser:</p>
          <p style="margin:0 0 16px;font-size:12px;color:#475569;word-break:break-all;">${escapeHtml(input.resetUrl)}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
          <p style="margin:0;font-size:12px;color:#94a3b8;">If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}

interface EmailOtpInput {
  code: string;
  displayName: string;
  ttlMinutes: number;
}

export function renderEmailOtp(input: EmailOtpInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Your SplitEasy verification code: ${input.code}`;
  const text = `Hi ${input.displayName},

Your SplitEasy verification code is: ${input.code}

Enter this code in the app to verify your email. The code expires in ${input.ttlMinutes} minutes.

If you did not create a SplitEasy account, you can ignore this message.
`;
  // Spaced digits with letter-spacing on the rendered code so it's easy to
  // read and copy from any mail client. No images, no external CSS.
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
        <tr><td>
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#0f172a;">Verify your email</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#334155;">Hi ${escapeHtml(input.displayName)}, enter this code in SplitEasy to confirm your email address.</p>
          <p style="margin:0 0 24px;text-align:center;">
            <span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:14px 22px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:30px;font-weight:600;letter-spacing:8px;color:#0f172a;">${escapeHtml(input.code)}</span>
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#64748b;">This code expires in ${input.ttlMinutes} minutes.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
          <p style="margin:0;font-size:12px;color:#94a3b8;">If you did not create a SplitEasy account, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}

interface MagicLinkEmailInput {
  signInUrl: string;
  ttlMinutes: number;
}

export function renderMagicLinkEmail(input: MagicLinkEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Your SplitEasy sign-in link";
  const text = `Sign in to SplitEasy by clicking the link below (valid for ${input.ttlMinutes} minutes):

${input.signInUrl}

If you did not request this link, you can ignore this message.
`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
        <tr><td>
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#0f172a;">Sign in to SplitEasy</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#334155;">Tap the button below to finish signing in. This link is single-use and will expire shortly.</p>
          <p style="margin:0 0 24px;">
            <a href="${escapeHtmlAttr(input.signInUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;">Sign in to SplitEasy</a>
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#64748b;">This link expires in ${input.ttlMinutes} minutes.</p>
          <p style="margin:0 0 8px;font-size:12px;color:#64748b;">Or paste this URL into your browser:</p>
          <p style="margin:0 0 16px;font-size:12px;color:#475569;word-break:break-all;">${escapeHtml(input.signInUrl)}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
          <p style="margin:0;font-size:12px;color:#94a3b8;">If you did not request this sign-in link, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttr(s: string): string {
  return escapeHtml(s);
}
