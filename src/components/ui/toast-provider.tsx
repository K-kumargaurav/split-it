"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

// Sonner's <Toaster /> portal mounted once at the root. Theme follows the
// app's resolved theme so toasts don't pop a white card in dark mode.
//
// Position: top-right on desktop, top-center on mobile feels right for a
// dashboard app where the bottom is taken by the tab bar. richColors gives
// us success/error tinted variants out of the box.
export function ToastProvider() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      theme={(resolvedTheme === "dark" ? "dark" : "light") as "dark" | "light"}
      toastOptions={{
        classNames: {
          toast: "rounded-xl",
        },
      }}
    />
  );
}
