import { formatPaise, formatRelativeTime } from "@/lib/format";
import { PendingSettlementActions } from "@/components/settlements/pending-settlement-actions";
import type { SettlementListItem } from "@/server/settlements/get-settlements";

interface PendingSettlementsSectionProps {
  groupId: string;
  pending: SettlementListItem[];
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

export function PendingSettlementsSection({
  groupId,
  pending,
  viewerId,
}: PendingSettlementsSectionProps) {
  if (pending.length === 0) return null;
  return (
    <section
      aria-labelledby="pending-settlements-heading"
      className="rounded-2xl border border-[#FFB020]/20 bg-[#FFB020]/[0.04] p-6"
    >
      <h2 id="pending-settlements-heading" className="mb-3 text-lg font-semibold text-[#F5F7FA]">
        Pending settlements
      </h2>
      <ul className="divide-y divide-[#FFB020]/10">
        {pending.map((s) => {
          const isReceiver = s.receiver.userId === viewerId;
          const isPayer = "userId" in s.payer && s.payer.userId === viewerId;
          return (
            <li key={s.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-[#8B93A7]">
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
                  {formatPaise(s.amountPaise)} · {paymentMethodLabel(s.paymentMethod)} ·{" "}
                  {formatRelativeTime(s.createdAt)}
                </p>
              </div>
              {isReceiver ? (
                <PendingSettlementActions groupId={groupId} settlementId={s.id} />
              ) : (
                <span className="rounded-full bg-[#FFB020]/10 px-2 py-0.5 text-xs font-medium text-[#FFB020]">
                  Awaiting confirmation
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
