"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { INVITE_LINK_DEFAULT_MAX_USES, INVITE_LINK_MAX_USES_CAP } from "@/lib/validations/invites";

interface InviteDialogProps {
  groupId: string;
  open: boolean;
  onClose: () => void;
}

interface InviteErrorBody {
  error?: { code?: string; message?: string };
}

interface SearchUser {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

const MAX_USES_OPTIONS = [10, 25, 100, 250, INVITE_LINK_MAX_USES_CAP];

function isEmail(value: string): boolean {
  return value.includes("@") && value.includes(".");
}

export function InviteDialog({ groupId, open, onClose }: InviteDialogProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"find" | "link">("find");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Find-user tab state.
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [findSubmitting, setFindSubmitting] = useState(false);
  const [findMessage, setFindMessage] = useState<string | null>(null);
  const [findError, setFindError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  // Link tab state.
  const [maxUses, setMaxUses] = useState<number>(INVITE_LINK_DEFAULT_MAX_USES);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkExpires, setLinkExpires] = useState<Date | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounced user search
  const searchUsers = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const cleaned = q.trim().replace(/^@/, "");
      if (cleaned.length < 2 || isEmail(q)) {
        setSuggestions([]);
        setShowSuggestions(false);
        setSearching(false);
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/v1/users/search?q=${encodeURIComponent(cleaned)}&groupId=${encodeURIComponent(groupId)}`,
          );
          if (!res.ok) {
            setSuggestions([]);
            setShowSuggestions(false);
            setSearching(false);
            return;
          }
          const data = (await res.json()) as { users: SearchUser[] };
          setSuggestions(data.users);
          setShowSuggestions(data.users.length > 0);
          setSelectedIndex(-1);
        } catch {
          setSuggestions([]);
          setShowSuggestions(false);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [groupId],
  );

  function handleQueryChange(value: string): void {
    setQuery(value);
    setFindError(null);
    setFindMessage(null);
    searchUsers(value);
  }

  function selectUser(user: SearchUser): void {
    setQuery(`@${user.handle}`);
    setSuggestions([]);
    setShowSuggestions(false);
    // Auto-submit
    void inviteByHandle(user.handle);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const user = suggestions[selectedIndex];
      if (user) selectUser(user);
    }
  }

  async function inviteByHandle(handle: string): Promise<void> {
    setFindError(null);
    setFindMessage(null);
    setFindSubmitting(true);

    try {
      const response = await fetch(`/api/v1/groups/${groupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "handle", handle: handle.toLowerCase() }),
      });

      setFindSubmitting(false);
      if (!response.ok) {
        let body: InviteErrorBody = {};
        try {
          body = (await response.json()) as InviteErrorBody;
        } catch { /* fall through */ }
        setFindError(body.error?.message ?? "Couldn't add user.");
        return;
      }

      setQuery("");
      toast.success("User added to group");
      setFindMessage("User added to the group.");
      router.refresh();
    } catch {
      setFindSubmitting(false);
      setFindError("Couldn't reach the server. Try again.");
    }
  }

  async function submitFind(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFindError(null);
    setFindMessage(null);
    setShowSuggestions(false);
    const trimmed = query.trim();
    if (!trimmed) {
      setFindError("Enter a username or email address.");
      return;
    }

    const isEmailInput = isEmail(trimmed);
    const payload = isEmailInput
      ? { type: "email" as const, email: trimmed.toLowerCase() }
      : { type: "handle" as const, handle: trimmed.replace(/^@/, "").toLowerCase() };

    setFindSubmitting(true);
    try {
      const response = await fetch(`/api/v1/groups/${groupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setFindSubmitting(false);
      if (!response.ok) {
        let body: InviteErrorBody = {};
        try {
          body = (await response.json()) as InviteErrorBody;
        } catch { /* fall through */ }
        setFindError(body.error?.message ?? "Couldn't send invite.");
        return;
      }

      const body = (await response.json()) as { status: string };
      setQuery("");
      if (body.status === "ADDED_DIRECTLY") {
        toast.success("User added to group");
        setFindMessage("User added to the group.");
      } else {
        toast.success("Invite sent");
        setFindMessage("Invitation email sent.");
      }
      router.refresh();
    } catch {
      setFindSubmitting(false);
      setFindError("Couldn't reach the server. Try again.");
    }
  }

  async function submitLink(): Promise<void> {
    setLinkError(null);
    setLinkUrl(null);
    setLinkExpires(null);
    setCopied(false);
    setLinkSubmitting(true);
    try {
      const response = await fetch(`/api/v1/groups/${groupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "link", maxUses }),
      });

      setLinkSubmitting(false);
      if (!response.ok) {
        let body: InviteErrorBody = {};
        try {
          body = (await response.json()) as InviteErrorBody;
        } catch { /* fall through */ }
        setLinkError(body.error?.message ?? "Couldn't generate link.");
        return;
      }

      const body = (await response.json()) as { token: string; expiresAt: string };
      const url = `${window.location.origin}/invite/${encodeURIComponent(body.token)}`;
      setLinkUrl(url);
      setLinkExpires(new Date(body.expiresAt));
    } catch {
      setLinkSubmitting(false);
      setLinkError("Couldn't reach the server. Try again.");
    }
  }

  async function copyLink(): Promise<void> {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-dialog-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-80 px-4 py-8 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-3xl border border-white/5 bg-card p-6 shadow-elevated sm:p-8"
      >
        <div className="mb-5 flex items-start justify-between">
          <h2
            id="invite-dialog-heading"
            className="text-[18px] font-bold tracking-[-0.02em] text-text-primary"
          >
            Invite to group
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-1.5 text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
          >
            <CloseIcon />
          </button>
        </div>

        <div role="tablist" className="mb-6 flex gap-1 rounded-2xl bg-white/[0.04] p-1">
          {(["find", "link"] as const).map((value) => {
            const active = tab === value;
            return (
              <button
                key={value}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "flex-1 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition",
                  active
                    ? "bg-white/[0.08] text-text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {value === "find" ? "Find user" : "Share link"}
              </button>
            );
          })}
        </div>

        {tab === "find" ? (
          <form onSubmit={submitFind} className="space-y-4" noValidate>
            <div className="relative">
              <label htmlFor="invite-query" className="mb-1.5 block text-[13px] text-text-secondary">
                Username or email
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="invite-query"
                  type="text"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => {
                    // Delay so click on suggestion registers first
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Search @username or type email..."
                  aria-expanded={showSuggestions}
                  aria-autocomplete="list"
                  aria-controls="invite-suggestions"
                  className={cn(
                    "block h-12 w-full rounded-2xl border border-white/[0.06] bg-bg px-4 text-sm text-text-primary transition",
                    "placeholder:text-text-secondary",
                    "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10",
                  )}
                />
                {searching ? (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-secondary border-t-accent" />
                  </span>
                ) : null}
              </div>

              {/* Autocomplete suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 ? (
                <ul
                  id="invite-suggestions"
                  ref={suggestionsRef}
                  role="listbox"
                  className="absolute left-0 right-0 z-10 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#1C2128] shadow-elevated"
                >
                  {suggestions.map((user, i) => (
                    <li
                      key={user.id}
                      role="option"
                      aria-selected={i === selectedIndex}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectUser(user);
                      }}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-4 py-2.5 transition",
                        i === selectedIndex
                          ? "bg-accent/10"
                          : "hover:bg-surface-hover",
                      )}
                    >
                      <UserAvatar user={user} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-text-primary">
                          {user.displayName}
                        </p>
                        <p className="truncate text-[12px] text-text-secondary">
                          @{user.handle}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-xl bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                        Add
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="mt-2 text-[12px] text-text-secondary">
                {query.trim().length > 0 && !isEmail(query) && !searching && suggestions.length === 0 && query.trim().replace(/^@/, "").length >= 2
                  ? "No users found. Try an email to send an invite link."
                  : "Start typing to search users, or enter an email for a 7-day invite."}
              </p>
            </div>

            {findError ? (
              <p role="alert" className="text-[13px] text-error">
                {findError}
              </p>
            ) : null}
            {findMessage ? (
              <p role="status" className="text-[13px] text-accent">
                {findMessage}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/[0.06] bg-card px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-white/10 hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={findSubmitting}
                className={cn(
                  "rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#0E1116] transition",
                  "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {findSubmitting ? "Adding..." : "Add to group"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="invite-max-uses" className="mb-1.5 block text-[13px] text-text-secondary">
                Max uses
              </label>
              <div className="relative">
                <select
                  id="invite-max-uses"
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number.parseInt(e.target.value, 10))}
                  className={cn(
                    "block h-12 w-full appearance-none rounded-2xl border border-white/[0.06] bg-bg px-4 pr-10 text-sm text-text-primary transition",
                    "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10",
                  )}
                >
                  {MAX_USES_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "use" : "uses"}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-text-secondary">
                  <ChevronIcon />
                </span>
              </div>
              <p className="mt-2 text-[12px] text-text-secondary">
                Link expires in 7 days. Limited to 10 joins per hour.
              </p>
            </div>

            {linkUrl ? (
              <div className="space-y-2.5">
                <div className="flex items-stretch gap-2">
                  <input
                    readOnly
                    value={linkUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 rounded-xl border border-white/[0.06] bg-bg px-3 py-2.5 font-mono text-[12px] text-text-primary"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className={cn(
                      "rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold transition",
                      copied
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-white/[0.06] bg-card text-text-primary hover:border-white/10 hover:bg-surface-hover",
                    )}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                {linkExpires ? (
                  <p className="text-[12px] text-text-secondary">
                    Expires {formatDateTime(linkExpires)}.
                  </p>
                ) : null}
                <p className="text-[12px] text-warning">
                  This is the only time we&apos;ll show this link — copy it now.
                </p>
              </div>
            ) : null}

            {linkError ? (
              <p role="alert" className="text-[13px] text-error">
                {linkError}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/[0.06] bg-card px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-white/10 hover:text-text-primary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={submitLink}
                disabled={linkSubmitting}
                className={cn(
                  "rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#0E1116] transition",
                  "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {linkSubmitting ? "Generating..." : linkUrl ? "Generate new" : "Generate link"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserAvatar({ user }: { user: SearchUser }) {
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
    );
  }
  const initial = (user.displayName[0] ?? user.handle[0] ?? "?").toUpperCase();
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[13px] font-bold text-accent">
      {initial}
    </span>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
    </svg>
  );
}
