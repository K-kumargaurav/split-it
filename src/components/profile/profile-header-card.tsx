"use client";

import { Camera } from "lucide-react";

import { formatDate } from "@/lib/format";
import { PremiumCard } from "@/components/ui/premium-card";

interface ProfileHeaderCardProps {
  avatarUrl: string;
  displayName: string;
  handle: string;
  createdAt?: string | null;
  uploading: boolean;
  initials: string;
  gradientClass: string;
  onAvatarClick: () => void;
}

export function ProfileHeaderCard({
  avatarUrl,
  displayName,
  handle,
  createdAt,
  uploading,
  initials,
  gradientClass,
  onAvatarClick,
}: ProfileHeaderCardProps) {
  return (
    <PremiumCard className="p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        {/* Avatar with camera overlay */}
        <div className="group relative flex-shrink-0">
          <div className="relative h-[72px] w-[72px]">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Your avatar"
                className="h-full w-full rounded-full object-cover ring-2 ring-[#00C896]"
              />
            ) : (
              <span
                aria-hidden="true"
                className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br text-2xl font-semibold text-white ${gradientClass}`}
              >
                {initials}
              </span>
            )}
            <button
              type="button"
              disabled={uploading}
              onClick={onAvatarClick}
              aria-label={uploading ? "Uploading…" : "Change avatar"}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none disabled:cursor-not-allowed"
            >
              <Camera size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Name + handle + member since */}
        <div className="text-center sm:text-left">
          <p className="text-xl font-semibold text-[#F5F7FA]">{displayName}</p>
          <p className="mt-0.5 text-sm text-[#8B93A7]">@{handle}</p>
          {createdAt ? (
            <p className="mt-1 text-[12px] text-[#8B93A7]">
              Member since {formatDate(createdAt)}
            </p>
          ) : null}
        </div>
      </div>
    </PremiumCard>
  );
}
