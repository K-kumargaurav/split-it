import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0E1116] px-6 text-center">
      <WifiOff className="mb-2 text-[#8B93A7]" size={48} aria-hidden="true" />
      <h1 className="text-[#F5F7FA] text-xl font-semibold">You&apos;re offline</h1>
      <p className="text-[#8B93A7] text-sm max-w-xs">
        Check your connection to continue
      </p>
    </main>
  );
}
