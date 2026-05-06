"use client";

import { cn } from "@/lib/cn";

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

function Skeleton({ width, height, className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-xl animate-shimmer",
        "bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.06)_50%,rgba(255,255,255,0.03)_100%)]",
        "[background-size:200%_100%]",
        className,
      )}
      style={width ?? height ? { width, height } : undefined}
    />
  );
}

export function BalanceHeroSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-3xl border border-white/5 bg-[#161B22] p-6 shadow-card sm:p-8"
    >
      {/* Greeting line */}
      <Skeleton className="h-3 w-32" />

      {/* Balance block */}
      <div className="mt-6">
        <Skeleton className="h-3 w-24" />
        {/* Large center number: 200px × 48px */}
        <Skeleton className="mt-3 h-12 w-[200px]" />
        <Skeleton className="mt-2 h-3 w-20" />
      </div>

      {/* 3 mini stat pills */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-white/[0.03] px-4 py-3">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-1.5 h-3.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-[#161B22] p-5 shadow-card"
    >
      {/* Top row: left circle + 2 lines, right amount */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <div className="space-y-1 text-right">
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="ml-auto h-2.5 w-10" />
        </div>
      </div>

      {/* Progress bar */}
      <Skeleton className="h-0.5 w-full rounded-full" />
    </div>
  );
}

export function ExpenseCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#161B22] px-4 py-3"
    >
      {/* Left: circle + 2 lines */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>

      {/* Right: 2 lines */}
      <div className="space-y-1">
        <Skeleton className="ml-auto h-4 w-16" />
        <Skeleton className="ml-auto h-2.5 w-12" />
      </div>
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-start gap-3 rounded-2xl p-4"
    >
      {/* Icon circle */}
      <Skeleton className="mt-0.5 h-9 w-9 flex-shrink-0 rounded-full" />

      {/* 2 lines + timestamp */}
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-2.5 w-full max-w-xs" />
        <Skeleton className="mt-1 h-2 w-16" />
      </div>
    </div>
  );
}
