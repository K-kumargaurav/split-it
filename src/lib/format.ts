// India-first currency formatting. Per CLAUDE.md:
//   - Money lives in DB as paise (BigInt) — never floats.
//   - Conversion to display happens ONLY in the UI layer (here).
//   - 10050 paise → "₹100.50" via Intl.NumberFormat("en-IN").

const inrFull = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export interface FormatOptions {
  compact?: boolean;
  hidePaiseIfZero?: boolean;
  signed?: boolean;
}

export function formatPaise(paise: number | bigint, options: FormatOptions = {}): string {
  const value = Number(paise);
  const rupees = value / 100;
  const abs = Math.abs(rupees);

  let formatter: Intl.NumberFormat = inrFull;
  if (options.compact && abs >= 10_000) formatter = inrCompact;
  else if (options.hidePaiseIfZero && Number.isInteger(rupees)) formatter = inrWhole;

  const formatted = formatter.format(abs);
  if (!options.signed) return value < 0 ? `-${formatted}` : formatted;
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function paiseToRupees(paise: number | bigint): number {
  return Number(paise) / 100;
}

export function rupeesToPaise(rupees: number): number {
  // Round half-away-from-zero to avoid floating-point drift on .5 boundaries
  // (e.g. 100.005 * 100 = 10000.499999... in IEEE-754).
  return Math.round(rupees * 100);
}

const RELATIVE = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });

const UNITS: { unit: Intl.RelativeTimeFormatUnit; secs: number }[] = [
  { unit: "year", secs: 31_536_000 },
  { unit: "month", secs: 2_592_000 },
  { unit: "week", secs: 604_800 },
  { unit: "day", secs: 86_400 },
  { unit: "hour", secs: 3_600 },
  { unit: "minute", secs: 60 },
];

export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const ts = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.round((ts.getTime() - now.getTime()) / 1000);
  if (Math.abs(diffSec) < 45) return "just now";
  for (const { unit, secs } of UNITS) {
    if (Math.abs(diffSec) >= secs) {
      return RELATIVE.format(Math.round(diffSec / secs), unit);
    }
  }
  return "just now";
}
