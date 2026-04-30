"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

// Drag-and-drop receipt upload + OCR preview. Used at the top of the
// "new expense" form. The actual storage upload happens after the expense
// is saved (we hold the original File on the parent and POST it to
// /expenses/:expId/receipt). This component only fires the OCR preview and
// shows a thumbnail.

const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

export interface OcrPrefill {
  totalAmountPaise: number | null;
  taxAmountPaise: number | null;
  merchantName: string | null;
  date: string | null;
}

interface ReceiptUploaderProps {
  groupId: string;
  onFileChange: (file: File | null) => void;
  onPrefill: (prefill: OcrPrefill) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; progress: number }
  | { kind: "ocr-failed"; reason: string }
  | { kind: "done" };

export function ReceiptUploader({ groupId, onFileChange, onPrefill }: ReceiptUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastObjectUrl = useRef<string | null>(null);

  // Free the previous blob URL when a new file is picked so we don't leak
  // memory across re-uploads. The current URL is held in state for render.
  useEffect(() => {
    return () => {
      if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current);
    };
  }, []);

  const handleFile = useCallback(
    async (picked: File) => {
      setError(null);

      if (!ACCEPTED_MIME.includes(picked.type)) {
        setError("Only JPEG, PNG, WebP, or PDF are accepted.");
        return;
      }
      if (picked.size > MAX_BYTES) {
        setError("Receipt exceeds the 10 MB size limit.");
        return;
      }

      if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current);
      const objectUrl = URL.createObjectURL(picked);
      lastObjectUrl.current = objectUrl;
      setPreviewUrl(objectUrl);
      setFile(picked);
      onFileChange(picked);

      // XMLHttpRequest is used (rather than fetch) only because we need a
      // real upload-progress event. fetch's ReadableStream upload progress
      // isn't supported in all browsers yet.
      setStatus({ kind: "uploading", progress: 0 });
      try {
        const result = await postWithProgress(
          `/api/v1/groups/${groupId}/receipt-ocr-preview`,
          picked,
          (pct) => setStatus({ kind: "uploading", progress: pct }),
        );
        if (result.ocrData) {
          onPrefill(result.ocrData);
          setStatus({ kind: "done" });
        } else {
          setStatus({ kind: "ocr-failed", reason: result.ocrError ?? "UNKNOWN" });
        }
      } catch (err) {
        setStatus({ kind: "ocr-failed", reason: err instanceof Error ? err.message : "UPLOAD_FAILED" });
      }
    },
    [groupId, onFileChange, onPrefill],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) void handleFile(dropped);
    },
    [handleFile],
  );

  const clear = () => {
    if (lastObjectUrl.current) {
      URL.revokeObjectURL(lastObjectUrl.current);
      lastObjectUrl.current = null;
    }
    setFile(null);
    setPreviewUrl(null);
    setStatus({ kind: "idle" });
    setError(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isImage = file && file.type !== "application/pdf";

  return (
    <section aria-label="Receipt upload" className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Receipt (optional)</label>
        {file ? (
          <button
            type="button"
            onClick={clear}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600"
          >
            Remove
          </button>
        ) : null}
      </div>

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
            isDragging
              ? "border-indigo-400 bg-indigo-50/60"
              : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-400",
          )}
        >
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Drop a receipt here, or click to browse
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPEG, PNG, WebP, or PDF up to 10 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) void handleFile(picked);
            }}
          />
        </div>
      ) : (
        <div className="flex items-start gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          {isImage && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Receipt thumbnail"
              className="h-24 w-24 flex-none rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 flex-none items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              PDF
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {(file.size / 1024).toFixed(0)} KB · {file.type}
            </p>
            <StatusLine status={status} />
          </div>
        </div>
      )}

      {error ? (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "uploading") {
    return (
      <div className="mt-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{ width: `${Math.max(5, status.progress)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {status.progress < 100 ? "Uploading…" : "Reading receipt…"}
        </p>
      </div>
    );
  }
  if (status.kind === "done") {
    return (
      <p className="mt-2 text-xs font-medium text-emerald-700">
        Pre-filled fields from receipt
      </p>
    );
  }
  if (status.kind === "ocr-failed") {
    return (
      <p className="mt-2 text-xs text-amber-700">
        Couldn’t read receipt — please fill manually
      </p>
    );
  }
  return null;
}

interface OcrPreviewResponse {
  ocrData: OcrPrefill | null;
  ocrError: string | null;
}

function postWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<OcrPreviewResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", file);

    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as OcrPreviewResponse);
        } catch {
          reject(new Error("Invalid response"));
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.send(fd);
  });
}
