"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { PremiumCard } from "@/components/ui/premium-card";
import { PremiumInput } from "@/components/ui/premium-input";
import { ProfileHeaderCard } from "./profile-header-card";
import { ProfilePreferencesSection } from "./profile-preferences-section";
import { ProfileAccountSection } from "./profile-account-section";

// Edit-in-place profile form. The "Save" button is disabled until at least
// one field has changed against the server-provided initial values, so users
// don't accidentally submit an unchanged record (which would be a 422 from
// the API's "at least one field" guard).

interface ProfileFormInitial {
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  upiId: string | null;
  email: string | null;
  currency?: string | null;
  locale?: string | null;
  createdAt?: string | null;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

const GRADIENT_PALETTES = [
  "from-[#00C896] to-[#00A67C]",
  "from-[#6366f1] to-[#4f46e5]",
  "from-[#f59e0b] to-[#d97706]",
  "from-[#ef4444] to-[#dc2626]",
  "from-[#8b5cf6] to-[#7c3aed]",
  "from-[#06b6d4] to-[#0891b2]",
];

function getGradient(name: string): string {
  const idx = (name.charCodeAt(0) ?? 0) % GRADIENT_PALETTES.length;
  return GRADIENT_PALETTES[idx];
}

export function ProfileForm({ initial }: { initial: ProfileFormInitial }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [handle, setHandle] = useState(initial.handle);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? "");
  const [upiId, setUpiId] = useState(initial.upiId ?? "");
  const [savedSnapshot, setSavedSnapshot] = useState<ProfileFormInitial>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(false), 3000);
    return () => window.clearTimeout(t);
  }, [success]);

  const dirty =
    displayName.trim() !== savedSnapshot.displayName ||
    handle.trim() !== savedSnapshot.handle ||
    (avatarUrl.trim() || null) !== savedSnapshot.avatarUrl ||
    (upiId.trim() || null) !== savedSnapshot.upiId;

  const initials = (displayName[0] ?? handle[0] ?? "?").toUpperCase();
  const gradientClass = getGradient(displayName || handle || "?");

  async function handleAvatarFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/users/me/avatar", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
        throw new Error(body?.error?.message ?? `Upload failed (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { avatarUrl: string | null };
      const newUrl = data.avatarUrl ?? "";
      setAvatarUrl(newUrl);
      // The server already persisted the URL, so the saved snapshot moves with
      // it. Other dirty fields stay dirty until the main Save runs.
      setSavedSnapshot((s) => ({ ...s, avatarUrl: newUrl || null }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload avatar.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty || submitting) return;
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const body: Record<string, unknown> = {};
    if (displayName.trim() !== savedSnapshot.displayName) body.displayName = displayName.trim();
    if (handle.trim() !== savedSnapshot.handle) body.handle = handle.trim();
    if ((avatarUrl.trim() || null) !== savedSnapshot.avatarUrl) body.avatarUrl = avatarUrl.trim();
    if ((upiId.trim() || null) !== savedSnapshot.upiId) body.upiId = upiId.trim();

    try {
      const res = await fetch("/api/v1/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
        throw new Error(errBody?.error?.message ?? `Save failed (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as {
        user: { displayName: string; handle: string; avatarUrl: string | null; upiId: string | null };
      };
      setSavedSnapshot((s) => ({
        ...s,
        displayName: data.user.displayName,
        handle: data.user.handle,
        avatarUrl: data.user.avatarUrl,
        upiId: data.user.upiId,
      }));
      setDisplayName(data.user.displayName);
      setHandle(data.user.handle);
      setAvatarUrl(data.user.avatarUrl ?? "");
      setUpiId(data.user.upiId ?? "");
      setSuccess(true);
      toast.success("Profile saved");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save profile.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24 md:pb-0">

      <ProfileHeaderCard
        avatarUrl={avatarUrl}
        displayName={displayName || initial.displayName}
        handle={handle || initial.handle}
        createdAt={initial.createdAt}
        uploading={uploading}
        initials={initials}
        gradientClass={gradientClass}
        onAvatarClick={() => fileInputRef.current?.click()}
      />

      {/* Hidden file input — ref lives here so handleAvatarFile can reset it */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleAvatarFile(f);
        }}
      />

      {/* ── Personal Info ────────────────────────────────────────────────── */}
      <PremiumCard className="p-6">
        <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-[#8B93A7]">
          Personal Info
        </h2>
        <div className="space-y-4">
          <PremiumInput
            label="Display name"
            id="displayName"
            name="displayName"
            autoComplete="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <PremiumInput
            label="Handle"
            id="handle"
            name="handle"
            autoComplete="username"
            required
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            leftIcon={<span className="text-sm text-[#8B93A7]">@</span>}
            hint="Lowercase letters, numbers, and underscores."
          />
          <PremiumInput
            label="UPI ID"
            id="upiId"
            name="upiId"
            placeholder="yourname@upi"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            hint="yourname@upi — used to receive settlement payments."
          />
          {initial.email ? (
            <div>
              <p className="mb-1.5 text-[13px] text-[#8B93A7]">Email</p>
              <div className="flex h-12 items-center rounded-2xl border border-white/[0.06] bg-[#0E1116]/60 px-4 text-sm text-[#8B93A7]">
                {initial.email}
              </div>
              <p className="mt-1.5 text-[12px] text-[#8B93A7]">
                Email changes aren&apos;t supported yet.
              </p>
            </div>
          ) : null}
        </div>
      </PremiumCard>

      <ProfilePreferencesSection
        initialCurrency={initial.currency ?? "INR"}
        initialLocale={initial.locale ?? "en-IN"}
      />

      <ProfileAccountSection />

      {/* ── Feedback ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="rounded-2xl border border-[#FF4757]/20 bg-[rgba(255,71,87,0.06)] px-4 py-3 text-sm text-[#FF4757]"
          >
            {error}
          </motion.p>
        ) : null}
        {success ? (
          <motion.p
            key="success"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className="rounded-2xl border border-[#00C896]/20 bg-[rgba(0,200,150,0.06)] px-4 py-3 text-sm text-[#00C896]"
          >
            Profile saved.
          </motion.p>
        ) : null}
      </AnimatePresence>

      {/* ── Save — sticky on mobile, inline on desktop ───────────────────── */}
      <div className="fixed bottom-16 left-0 right-0 z-10 border-t border-white/[0.04] bg-[#0E1116]/90 px-4 py-3 backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:pb-6 md:backdrop-blur-none">
        <button
          type="submit"
          disabled={!dirty || submitting}
          className="w-full rounded-2xl bg-[#00C896] py-3 text-sm font-semibold text-[#0E1116] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto md:px-6"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
