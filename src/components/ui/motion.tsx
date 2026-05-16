"use client";

import { m } from "framer-motion";

interface Props {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function FadeIn({ children, delay = 0, className }: Props) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        type: "spring",
        stiffness: 60,
        damping: 20,
        delay,
      }}
    >
      {children}
    </m.div>
  );
}

export function ScaleIn({ children, delay = 0, className }: Props) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 20,
        delay,
      }}
    >
      {children}
    </m.div>
  );
}

export function SlideUp({ children, delay = 0, className }: Props) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
    >
      {children}
    </m.div>
  );
}

const staggerContainer = {
  hidden: {},
  show: (staggerDelay: number) => ({
    transition: {
      staggerChildren: staggerDelay,
    },
  }),
};

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export function StaggerChildren({
  children,
  className,
  staggerDelay = 0.06,
}: StaggerProps) {
  return (
    <m.div
      className={className}
      variants={staggerContainer}
      custom={staggerDelay}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <m.div key={i} variants={staggerItem}>
              {child}
            </m.div>
          ))
        : children}
    </m.div>
  );
}
