"use client";

import { m } from "framer-motion";
import {
  type LucideIcon,
  Receipt,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
  Bell,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";

export interface NotificationItemProps {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date | string;
  entityType: string | null;
  entityId: string | null;
  onMarkRead: (id: string) => void;
}

interface IconConfig {
  Icon: LucideIcon;
  bg: string;
  color: string;
}

const ICON_CONFIG: Record<string, IconConfig> = {
  EXPENSE_ADDED: {
    Icon: Receipt,
    bg: "rgba(0,200,150,0.1)",
    color: "#00C896",
  },
  SETTLEMENT_PENDING: {
    Icon: Clock,
    bg: "rgba(255,176,32,0.1)",
    color: "#FFB020",
  },
  SETTLEMENT_CONFIRMED: {
    Icon: CheckCircle,
    bg: "rgba(0,200,150,0.1)",
    color: "#00C896",
  },
  SETTLEMENT_DISPUTED: {
    Icon: AlertCircle,
    bg: "rgba(255,71,87,0.1)",
    color: "#FF4757",
  },
  EXPENSE_EDIT_PROPOSAL: {
    Icon: Edit,
    bg: "rgba(139,147,167,0.1)",
    color: "#8B93A7",
  },
};

const DEFAULT_ICON: IconConfig = {
  Icon: Bell,
  bg: "rgba(139,147,167,0.1)",
  color: "#8B93A7",
};

function entityHref(
  entityType: string | null,
  entityId: string | null,
): string | null {
  if (!entityType || !entityId) return null;
  if (entityType === "GROUP") return `/groups/${entityId}`;
  return null;
}

export function NotificationItem({
  id,
  type,
  title,
  body,
  isRead,
  createdAt,
  entityType,
  entityId,
  onMarkRead,
}: NotificationItemProps) {
  const router = useRouter();
  const { Icon, bg, color } = ICON_CONFIG[type] ?? DEFAULT_ICON;
  const href = entityHref(entityType, entityId);

  function handleClick() {
    if (!isRead) onMarkRead(id);
    if (href) router.push(href);
  }

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.18 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      aria-label={title}
      className={cn(
        "relative cursor-pointer rounded-2xl p-4 border-l-2 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C896]",
        isRead
          ? "border-l-transparent bg-transparent hover:bg-white/[0.02]"
          : "border-l-[#00C896] bg-[rgba(0,200,150,0.04)] hover:bg-[rgba(0,200,150,0.06)]",
      )}
    >
      {!isRead && (
        <span
          aria-hidden="true"
          className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-[#00C896]"
        />
      )}

      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: bg }}
        >
          <Icon size={16} style={{ color }} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#F5F7FA]">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-[#8B93A7]">{body}</p>
          <p className="mt-1 text-[11px] text-[#8B93A7]">
            {formatRelativeTime(createdAt)}
          </p>
        </div>
      </div>
    </m.div>
  );
}
