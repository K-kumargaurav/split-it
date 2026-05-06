import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SplitEasy — Split bills with friends, the easy way",
  description:
    "SplitEasy is the modern bill splitter for groups, trips, and households. Track shared expenses, settle up in one tap, and never argue over who owes whom again.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning is required by next-themes — it injects the
  // `dark` class onto <html> in a pre-hydration script to prevent the FOUC,
  // which legitimately differs from the server-rendered markup.
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} antialiased bg-[#0E1116]`}
      >
        <ThemeProvider>
          {children}
          <Toaster
            position="bottom-center"
            theme="dark"
            toastOptions={{
              style: {
                background: "#161B22",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#F5F7FA",
                borderRadius: "16px",
                fontSize: "14px",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
