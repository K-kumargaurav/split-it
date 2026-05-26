"use client";

import { useEffect, useRef } from "react";
import { Copy } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { generateUpiLink } from "@/lib/upi";

interface UpiPaymentBlockProps {
  vpa: string | null;
  displayName: string;
  amountPaise: number;
  phone?: string | null;
}

export function UpiPaymentBlock({
  vpa,
  displayName,
  amountPaise,
  phone,
}: UpiPaymentBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const upiString = vpa && amountPaise > 0
    ? safeBuildUpiString({ vpa, name: displayName, amountPaise })
    : null;

  useEffect(() => {
    if (!upiString || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, upiString, { width: 200 });
  }, [upiString]);

  if (!vpa && !phone) {
    return (
      <p className="text-sm text-text-secondary">
        Ask them to add a UPI ID in their profile.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* UPI ID copy row */}
      {vpa ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-surface-hover bg-[rgba(255,255,255,0.02)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
              UPI ID
            </p>
            <p className="mt-0.5 truncate font-mono text-sm text-text-primary">
              {vpa}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(vpa);
              toast.success("Copied!");
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-dashed px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:text-text-primary"
            aria-label="Copy UPI ID"
          >
            <Copy size={12} />
            Copy
          </button>
        </div>
      ) : null}

      {/* Phone copy row */}
      {phone ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-surface-hover bg-[rgba(255,255,255,0.02)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
              Phone
            </p>
            <p className="mt-0.5 truncate font-mono text-sm text-text-primary">
              {phone}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(phone);
              toast.success("Copied!");
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-dashed px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:text-text-primary"
            aria-label="Copy phone number"
          >
            <Copy size={12} />
            Copy
          </button>
        </div>
      ) : null}

      {/* QR Code */}
      {upiString ? (
        <div className="flex flex-col items-center gap-2 pt-1">
          <canvas ref={canvasRef} className="rounded-xl" aria-label="UPI QR code" />
          <p className="text-center text-[11px] text-text-secondary">
            Scan with GPay, PhonePe, or any UPI app
          </p>
        </div>
      ) : null}
    </div>
  );
}

function safeBuildUpiString(args: {
  vpa: string;
  name: string;
  amountPaise: number;
}): string | null {
  if (args.amountPaise <= 0) return null;
  try {
    return generateUpiLink({
      vpa: args.vpa,
      name: args.name,
      amount: BigInt(args.amountPaise),
      note: "SplitEasy settlement",
    });
  } catch {
    return null;
  }
}
