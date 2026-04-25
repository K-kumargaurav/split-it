import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";

interface BalanceSummaryProps {
  netBalancePaise: number;
  groupCount: number;
  displayName: string;
}

// SPEC §4.12: header summary that headlines the dashboard.
//   • Net > 0  → "You are owed ₹X"  (green)
//   • Net < 0  → "You owe ₹X"       (red)
//   • Net == 0 → "You're all settled up" (neutral)
export function BalanceSummary({ netBalancePaise, groupCount, displayName }: BalanceSummaryProps) {
  const settled = netBalancePaise === 0;
  const owedToYou = netBalancePaise > 0;
  const absPaise = Math.abs(netBalancePaise);

  const accent = settled
    ? "from-slate-700 to-slate-900"
    : owedToYou
      ? "from-emerald-600 to-emerald-800"
      : "from-rose-600 to-rose-800";

  const eyebrow = settled
    ? "All settled up"
    : owedToYou
      ? "You are owed"
      : "You owe";

  return (
    <section
      aria-labelledby="balance-heading"
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-br p-7 text-white shadow-sm sm:p-9",
        accent,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle at 80% 0%, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <p className="text-sm font-medium text-white/70">
        {greet()}, {firstName(displayName)}
      </p>

      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-white/60">
        {eyebrow}
      </p>

      {settled ? (
        <h2
          id="balance-heading"
          className="mt-2 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
        >
          You&apos;re all settled up
          {groupCount > 0 ? (
            <span className="block text-base font-normal text-white/70">
              across {groupCount} active {groupCount === 1 ? "group" : "groups"}
            </span>
          ) : null}
        </h2>
      ) : (
        <h2
          id="balance-heading"
          className="mt-2 text-balance text-4xl font-semibold leading-tight tracking-tight tabular-nums sm:text-5xl"
        >
          {formatPaise(absPaise)}
        </h2>
      )}

      {!settled && groupCount > 0 ? (
        <p className="mt-2 text-sm text-white/70">
          across {groupCount} active {groupCount === 1 ? "group" : "groups"}
        </p>
      ) : null}
    </section>
  );
}

function greet(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}
