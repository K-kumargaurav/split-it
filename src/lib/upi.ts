// UPI deep-link generator (SPEC §4.7). Format:
//   upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<note>
//
// Per SPEC §10 / CLAUDE.md: money lives as integer paise; UPI requires the
// `am` parameter in rupees with 2 decimal places. We divide by 100 using
// BigInt arithmetic + a hand-formatted decimal so the float boundary never
// silently drops paise (the same reason rupeesToPaise refuses floats).
//
// All param values are URL-encoded with encodeURIComponent — UPI IDs can
// contain dots and hyphens which are safe, but display names + notes can
// contain `&`, `?`, spaces, unicode. The base scheme `upi://pay` is opened
// natively by UPI apps on Android / iOS; on desktop the same string can be
// rendered into a QR code so a phone can scan it.

export interface UpiLinkInput {
  vpa: string; // receiver VPA, e.g. "kumar@upi"
  name: string; // receiver display name
  amount: bigint; // paise — integer
  note: string; // transaction note, e.g. "SplitEasy: Goa Trip settlement"
}

export function generateUpiLink(input: UpiLinkInput): string {
  const vpa = input.vpa.trim();
  const name = input.name.trim();
  const note = input.note.trim();

  if (vpa.length === 0) throw new Error("UPI VPA is required.");
  if (!isValidVpa(vpa)) throw new Error(`Invalid UPI VPA: ${vpa}`);
  if (input.amount < BigInt(0)) {
    throw new Error("UPI amount must be non-negative.");
  }

  const amountRupees = paiseToRupeesString(input.amount);

  const params = new URLSearchParams();
  params.set("pa", vpa);
  params.set("pn", name);
  params.set("am", amountRupees);
  params.set("cu", "INR");
  params.set("tn", note);

  // URLSearchParams encodes spaces as `+` which is fine in form-encoded
  // bodies but UPI apps expect `%20`. Swap so iOS/Android intent handlers
  // parse the note correctly.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

// "yourname@upi" / "9876543210@bank". One '@', non-empty handle and PSP
// label, with the handle / PSP made of letters, digits, dots, underscores,
// or hyphens. Permissive on purpose — VPAs vary across providers.
const VPA_RE = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/;

export function isValidVpa(vpa: string): boolean {
  if (typeof vpa !== "string") return false;
  const trimmed = vpa.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  return VPA_RE.test(trimmed);
}

// Convert a non-negative `paise` BigInt into a fixed-2-decimal rupee string
// without going through Number (so we never lose precision on amounts > 2^53
// paise — overkill for v1's ₹10,00,000 ceiling but cheap to do correctly).
function paiseToRupeesString(paise: bigint): string {
  const HUNDRED = BigInt(100);
  const whole = paise / HUNDRED;
  const fraction = paise % HUNDRED;
  const fractionStr = fraction.toString().padStart(2, "0");
  return `${whole.toString()}.${fractionStr}`;
}
