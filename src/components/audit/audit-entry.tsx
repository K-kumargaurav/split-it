"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { AuditEntryClient } from "./audit-timeline";

type Action = AuditEntryClient["action"];
type EntityType = AuditEntryClient["entityType"];

const DOT_COLOR: Record<Action, string> = {
  CREATED:   "#00C896",
  UPDATED:   "#FFB020",
  DELETED:   "#FF4757",
  CONFIRMED: "#00C896",
  DISPUTED:  "#FF4757",
  APPROVED:  "#00C896",
  REJECTED:  "#FF4757",
};

const AVATAR_PALETTE = [
  "#6366F1", "#00C896", "#F59E0B", "#EC4899", "#06B6D4", "#8B5CF6",
];

function hashAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

const ENTITY_LABEL: Record<EntityType, string> = {
  EXPENSE: "expense",
  SETTLEMENT: "settlement",
  MEMBER: "member",
  GROUP: "group",
  CATEGORY: "category",
  RECURRING: "recurring template",
};

function describeAction(action: Action, entityType: EntityType): string {
  switch (action) {
    case "CREATED":   return `added a new ${ENTITY_LABEL[entityType]}`;
    case "UPDATED":   return "edited";
    case "DELETED":   return "deleted";
    case "APPROVED":  return "approved a change to";
    case "REJECTED":  return "rejected a change to";
    case "CONFIRMED": return "confirmed";
    case "DISPUTED":  return "disputed";
    default:          return "changed";
  }
}

function pickStr(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function describeTarget(entry: AuditEntryClient): string {
  const title =
    pickStr(entry.newValue, "title") ??
    pickStr(entry.newValue, "name") ??
    pickStr(entry.newValue, "displayName") ??
    pickStr(entry.oldValue, "title") ??
    pickStr(entry.oldValue, "name") ??
    pickStr(entry.oldValue, "displayName");
  if (title) return `'${title}'`;
  if (entry.action === "CREATED") return "";
  return `a ${ENTITY_LABEL[entry.entityType]}`;
}

interface Props {
  entry: AuditEntryClient;
  viewerId: string;
  isLast: boolean;
}

export function AuditEntry({ entry, viewerId, isLast }: Props) {
  const [open, setOpen] = useState(false);

  const isYou = entry.actor.id === viewerId;
  const actorName = isYou ? "You" : entry.actor.displayName;
  const verb = describeAction(entry.action, entry.entityType);
  const target = describeTarget(entry);
  const initial = (entry.actor.displayName[0] ?? entry.actor.handle[0] ?? "?").toUpperCase();
  const dotColor = DOT_COLOR[entry.action];
  const avatarBg = hashAvatarColor(entry.actor.displayName);
  const hasDiff = entry.diffLines.length > 0;

  return (
    <div className="flex gap-3">
      {/* Timeline track: dot + connecting line */}
      <div className="flex w-2.5 flex-shrink-0 flex-col items-center">
        <div
          className="z-10 mt-4 h-2 w-2 flex-shrink-0 rounded-full ring-2 ring-bg"
          style={{ backgroundColor: dotColor }}
          aria-hidden="true"
        />
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-white/[0.06]" aria-hidden="true" />
        )}
      </div>

      {/* Actor avatar */}
      <div
        className="mt-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
        style={{ backgroundColor: avatarBg }}
        aria-label={`${entry.actor.displayName} avatar`}
      >
        {initial}
      </div>

      {/* Content */}
      <div className={`min-w-0 flex-1 ${isLast ? "pb-2" : "pb-6"}`}>
        <p className="text-[14px] leading-snug text-text-secondary">
          <span className="font-medium text-text-primary">{actorName}</span>
          {" "}{verb}
          {target ? (
            <> <span className="text-text-primary">{target}</span></>
          ) : null}
        </p>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          {formatRelativeTime(entry.createdAt)} · {formatDateTime(entry.createdAt)}
        </p>

        {hasDiff ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded text-[12px] text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40"
            >
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="inline-flex"
              >
                <ChevronDown size={13} aria-hidden="true" />
              </motion.span>
              {open ? "Hide changes" : "View changes"}
            </button>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <ul className="mt-2 space-y-0.5 rounded-xl bg-white/[0.02] p-3">
                    {entry.diffLines.map((line, i) => (
                      <li key={i} className="text-[13px] leading-relaxed text-text-secondary">
                        {line}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </div>
  );
}
