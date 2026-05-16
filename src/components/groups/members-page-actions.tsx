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
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#0E1116] shadow-sm transition",
          "hover:opacity-90 active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        )}
      >
        <PlusIcon />
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
          "rounded-xl border border-error/20 bg-error/5 px-3 py-1.5 text-[12px] font-medium text-error transition",
          "hover:border-error/30 hover:bg-error/10",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {submitting ? "Removing..." : "Remove"}
      </button>
      {error ? (
        <p role="alert" className="text-[12px] text-error">
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
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleLeave}
        disabled={submitting}
        className={cn(
          "rounded-2xl border border-error/20 bg-error/10 px-4 py-2.5 text-sm font-semibold text-error transition",
          "hover:border-error/30 hover:bg-error/15",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {submitting ? "Leaving..." : "Leave this group"}
      </button>
      {error ? (
        <p role="alert" className="text-[12px] text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z" />
    </svg>
  );
}
