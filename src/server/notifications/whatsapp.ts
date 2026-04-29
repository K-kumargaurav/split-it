// WhatsApp transport via the Twilio API (sandbox-compatible). Opt-in only —
// SPEC §4.10 limits WhatsApp/SMS to settlement reminders and other high-
// signal events for users who explicitly enabled the channel in prefs.
//
// We call Twilio's REST endpoint directly with `fetch` to avoid pulling the
// full SDK. The "From" number must be in `whatsapp:+E164` format and must
// match a sender configured on the Twilio account (or the sandbox number).

const TWILIO_HOST = "https://api.twilio.com";

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  from: string;
}

function loadConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

function normalizeWhatsAppAddress(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  return `whatsapp:${trimmed}`;
}

export interface SendWhatsAppResult {
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

export async function sendWhatsApp(
  phone: string,
  message: string,
): Promise<SendWhatsAppResult> {
  const config = loadConfig();
  if (!config) return { status: "skipped", reason: "twilio-not-configured" };
  if (!phone) return { status: "skipped", reason: "no-phone" };

  const url = `${TWILIO_HOST}/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const body = new URLSearchParams({
    From: normalizeWhatsAppAddress(config.from),
    To: normalizeWhatsAppAddress(phone),
    Body: message,
  });

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString(
    "base64",
  );

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      return { status: "failed", reason: `http-${res.status}` };
    }
    return { status: "sent" };
  } catch (err) {
    return {
      status: "failed",
      reason: err instanceof Error ? err.message : "unknown",
    };
  }
}
