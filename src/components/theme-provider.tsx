"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

// Thin client wrapper around next-themes' provider so the server-rendered
// RootLayout can stay an RSC. Configuration is held here for clarity:
//
//   • attribute="class"  — toggles a `dark` class on <html>, matching the
//     Tailwind `darkMode: "class"` setting.
//   • defaultTheme="system" — first-visit users follow their OS preference.
//   • enableSystem — keeps "system" as a discrete user-selectable choice
//     so we render a three-way Light / Dark / System toggle.

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
