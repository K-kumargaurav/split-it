import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";

export interface BalanceLine {
  direction: "owed" | "owes";
  counterpartyName: string;
  counterpartyId: string;
  amountPaise: bigint;
}

interface BalancesSectionProps {
  lines: BalanceLine[];
  mode: "DIRECT" | "SIMPLIFIED";
  groupId: string;
}

export function BalancesSection({ lines, mode, groupId }: BalancesSectionProps) {
  return (
    <section
      aria-labelledby="balances-heading"
      className="rounded-2xl border border-white/5 bg-[#161B22] p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="balances-heading" className="text-lg font-semibold text-[#F5F7FA]">
          Balances
        </h2>
        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-[#8B93A7]">
          {mode === "DIRECT" ? "Direct" : "Simplified"}
        </span>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-[#8B93A7]">
          You&apos;re all settled up in this group.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {lines.map((line, i) => (
            <li
              key={`${line.direction}-${line.counterpartyId}-${i}`}
              className="flex items-center justify-between gap-4 py-3"
            >
              <p className="text-sm text-[#8B93A7]">
                {line.direction === "owed" ? (
                  <>
                    <span className="font-medium text-[#F5F7FA]">{line.counterpartyName}</span> owes
                    you
                  </>
                ) : (
                  <>
                    You owe{" "}
                    <span className="font-medium text-[#F5F7FA]">{line.counterpartyName}</span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-3">
                <p
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    line.direction === "owed" ? "text-[#00C896]" : "text-[#FF4757]",
                  )}
                >
                  {formatPaise(line.amountPaise)}
                </p>
                {line.direction === "owes" ? (
                  <Link
                    href={`/groups/${groupId}/settlements/new?to=${line.counterpartyId}`}
                    className="rounded-lg border border-white/5 px-2.5 py-1 text-xs font-medium text-[#8B93A7] transition hover:border-white/10 hover:text-[#F5F7FA]"
                  >
                    Mark as paid
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
