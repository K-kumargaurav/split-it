"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

const STORAGE_KEY = "pwa-prompt";
const VISIT_KEY = "pwa-visit-count";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY) === "dismissed";
    if (dismissed) return;

    const visitCount = parseInt(localStorage.getItem(VISIT_KEY) ?? "0", 10);
    const nextCount = visitCount + 1;
    localStorage.setItem(VISIT_KEY, String(nextCount));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (nextCount >= 2) {
        setShow(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    }
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "dismissed");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={handleDismiss}
            aria-hidden="true"
          />

          {/* Bottom sheet */}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Install SplitEasy"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-[#161B22] rounded-t-3xl px-6 pt-6 pb-10"
          >
            {/* Drag handle */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

            <div className="flex items-center gap-4 mb-4">
              <Image
                src="/icons/icon-192x192.png"
                alt="SplitEasy icon"
                width={48}
                height={48}
                className="rounded-xl"
              />
              <div>
                <p className="text-[#F5F7FA] font-semibold text-base leading-tight">
                  Install SplitEasy
                </p>
                <p className="text-[#8B93A7] text-sm mt-0.5">
                  Get the full app experience
                </p>
              </div>
            </div>

            <button
              onClick={handleInstall}
              className="w-full rounded-2xl bg-[#00C896] text-[#0E1116] font-semibold py-3.5 text-sm mb-3 hover:bg-[#00b384] transition-colors"
            >
              Add to Home Screen
            </button>
            <button
              onClick={handleDismiss}
              className="w-full text-[#8B93A7] text-sm py-2 hover:text-[#F5F7FA] transition-colors"
            >
              Not now
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
