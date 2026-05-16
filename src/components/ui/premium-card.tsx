"use client";

import { m } from "framer-motion";

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function PremiumCard({ children, className = "", onClick }: PremiumCardProps) {
  return (
    <m.div
      className={`bg-[#161B22] border border-white/5 rounded-card shadow-card ${className}`}
      whileHover={{ y: -1, borderColor: "rgba(255,255,255,0.08)" }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      {children}
    </m.div>
  );
}
