"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { m } from "framer-motion";

import { cn } from "@/lib/cn";

interface ExportSectionProps {
  groupId: string;
}

export function ExportSection({ groupId }: ExportSectionProps) {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildHref(format: "pdf" | "csv"): string {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const query = params.toString();
    return `/api/v1/groups/${groupId}/export/${format}${query ? `?${query}` : ""}`;
  }

  async function download(format: "pdf" | "csv"): Promise<void> {
    setBusy(format);
    setError(null);
    try {
      const response = await fetch(buildHref(format));
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(json?.error?.message ?? "Couldn't generate the export.");
        return;
      }
      const blob = await response.blob();
      const filename =
        parseFilename(response.headers.get("Content-Disposition")) ??
        `spliteasy-export.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't generate the export.");
    } finally {
      setBusy(null);
    }
  }

  const dateInputClass = cn(
    "block w-full rounded-2xl border border-white/[0.06] bg-card px-4 py-3 text-sm text-text-primary transition",
    "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10",
    "[color-scheme:dark]",
  );

  return (
    <div className="space-y-5">
      {/* Date range */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="export-start" className="mb-1.5 block text-[13px] text-text-secondary">
            From
          </label>
          <input
            id="export-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={dateInputClass}
          />
        </div>
        <div>
          <label htmlFor="export-end" className="mb-1.5 block text-[13px] text-text-secondary">
            To
          </label>
          <input
            id="export-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={dateInputClass}
          />
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex flex-wrap gap-3">
        <m.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => download("pdf")}
          disabled={busy !== null}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 px-5 text-sm font-medium text-text-primary transition",
            "hover:border-white/20 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Download size={15} aria-hidden="true" />
          {busy === "pdf" ? "Generating…" : "Export PDF"}
        </m.button>

        <m.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => download("csv")}
          disabled={busy !== null}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 px-5 text-sm font-medium text-text-primary transition",
            "hover:border-white/20 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Download size={15} aria-hidden="true" />
          {busy === "csv" ? "Generating…" : "Export CSV"}
        </m.button>
      </div>

      {error ? (
        <p role="alert" className="text-[13px] text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  return match?.[1] ?? null;
}
