"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinGroupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0E1116] px-4 text-[#F5F7FA]">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Invalid invite link</h1>
          <p className="text-sm text-[#8B949E]">
            This link is missing the invite token. Check the original invite email or ask for a
            new link.
          </p>
          <Link
            href="/dashboard"
            className="inline-block rounded-2xl bg-[#238636] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Go to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  async function handleJoin() {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          (data as { error?: { message?: string } } | null)?.error?.message ??
          "Could not accept this invite. It may have expired or already been used.";
        setErrorMsg(msg);
        setStatus("error");
        return;
      }
      const groupId = (data as { groupId: string }).groupId;
      router.push(`/groups/${groupId}`);
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0E1116] px-4 text-[#F5F7FA]">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">You&apos;ve been invited</h1>
          <p className="text-sm text-[#8B949E]">
            Accept the invite to join the group and start tracking shared expenses.
          </p>
        </div>

        {errorMsg ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-2xl border border-error/20 bg-error/[0.08] px-4 py-3 text-sm text-error"
          >
            {errorMsg}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleJoin}
            disabled={status === "loading"}
            className="w-full rounded-2xl bg-[#238636] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-busy={status === "loading"}
          >
            {status === "loading" ? "Joining…" : "Accept Invite"}
          </button>

          <Link
            href="/dashboard"
            className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] px-5 py-3 text-center text-sm font-medium text-[#8B949E] transition-colors hover:text-[#F5F7FA]"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
