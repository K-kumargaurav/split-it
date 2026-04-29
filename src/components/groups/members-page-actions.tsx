"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { InviteDialog } from "@/components/groups/invite-dialog";

// Client-side actions for the members page: opens the invite dialog,
// removes a member (owner-only), and lets non-owners leave the group. Each
// action is a thin wrapper over the corresponding REST endpoint.

interface InviteButtonProps {
  groupId: string;
}

export function InviteButton({ groupId }: InviteButtonProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        Invite
      </button>
      <InviteDialog groupId={groupId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface RemoveMemberButtonProps {
  groupId: string;
  userId: string;
  displayName: string;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function RemoveMemberButton({
  groupId,
  userId,
  displayName,
}: RemoveMemberButtonProps): React.ReactElement {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(): Promise<void> {
    if (
      !window.confirm(
        `Remove ${displayName} from this group? They'll lose access immediately.`,
      )
    ) {
      return;
    }
    setError(null);
    setSubmitting(true);
    let response: Response;
    try {
      response = await fetch(
        `/api/v1/groups/${groupId}/members/${userId}`,
        { method: "DELETE" },
      );
    } catch {
      setSubmitting(false);
      setError("Couldn't reach the server.");
      return;
    }
    setSubmitting(false);
    if (!response.ok) {
      let body: ApiErrorBody = {};
      try {
        body = (await response.json()) as ApiErrorBody;
      } catch {
        // fall through
      }
      setError(body.error?.message ?? "Couldn't remove member.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRemove}
        disabled={submitting}
        className={cn(
          "rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {submitting ? "Removing…" : "Remove"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface LeaveGroupButtonProps {
  groupId: string;
  userId: string;
}

export function LeaveGroupButton({
  groupId,
  userId,
}: LeaveGroupButtonProps): React.ReactElement {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLeave(): Promise<void> {
    if (
      !window.confirm(
        "Leave this group? You'll lose access until someone re-invites you.",
      )
    ) {
      return;
    }
    setError(null);
    setSubmitting(true);
    let response: Response;
    try {
      response = await fetch(
        `/api/v1/groups/${groupId}/members/${userId}`,
        { method: "DELETE" },
      );
    } catch {
      setSubmitting(false);
      setError("Couldn't reach the server.");
      return;
    }
    setSubmitting(false);
    if (!response.ok) {
      let body: ApiErrorBody = {};
      try {
        body = (await response.json()) as ApiErrorBody;
      } catch {
        // fall through
      }
      setError(body.error?.message ?? "Couldn't leave group.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleLeave}
        disabled={submitting}
        className={cn(
          "rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {submitting ? "Leaving…" : "Leave group"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
