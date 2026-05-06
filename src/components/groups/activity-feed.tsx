import { formatPaise, formatRelativeTime } from "@/lib/format";
import type { SettlementListItem } from "@/server/settlements/get-settlements";

interface ActivityFeedProps {
  settlements: SettlementListItem[];
  viewerId: string;
}

function paymentMethodLabel(method: SettlementListItem["paymentMethod"]): string {
  switch (method) {
    case "CASH":
      return "Cash";
    case "UPI":
      return "UPI";
    case "RAZORPAY":
      return "Razorpay";
    case "STRIPE":
      return "Stripe";
    default:
      return "Other";
  }
}

export function ActivityFeed({ settlements, viewerId }: ActivityFeedProps) {
  if (settlements.length === 0) return null;
  const recent = settlements.slice(0, 8);
  return (
    <section
      aria-labelledby="activity-heading"
      className="rounded-2xl border border-white/5 bg-[#161B22] p-6"
    >
      <h2 id="activity-heading" className="mb-3 text-lg font-semibold text-[#F5F7FA]">
        Settlement activity
      </h2>
      <ul className="divide-y divide-white/5">
        {recent.map((s) => {
          const isPayer = "userId" in s.payer && s.payer.userId === viewerId;
          const isReceiver = s.receiver.userId === viewerId;
          const when = s.confirmedAt ?? s.createdAt;
          return (
            <li key={s.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-[#8B93A7]">
                  {isPayer ? (
                    <>
                      You paid{" "}
                      <span className="font-medium text-[#F5F7FA]">{s.receiver.displayName}</span>
                    </>
                  ) : isReceiver ? (
                    <>
                      <span className="font-medium text-[#F5F7FA]">{s.payer.displayName}</span>{" "}
                      paid you
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-[#F5F7FA]">{s.payer.displayName}</span>{" "}
                      →{" "}
                      <span className="font-medium text-[#F5F7FA]">{s.receiver.displayName}</span>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[#8B93A7]">
                  {paymentMethodLabel(s.paymentMethod)} · {formatRelativeTime(when)}
                </p>
              </div>
              <p className="font-mono text-sm font-semibold tabular-nums text-[#F5F7FA]">
                {formatPaise(s.amountPaise)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
