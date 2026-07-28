import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import Link from "next/link";

export const metadata: Metadata = {
  title: "CrowdVJ Dashboard",
  description: "Control and Archive for CrowdVJ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-neutral-200 min-h-screen flex flex-col`}
      >
        <header className="sticky top-0 z-50 flex items-center h-14 px-6 border-b border-white/10 bg-black/80 backdrop-blur-md text-sm font-medium">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              {/* Simple Vercel-like triangle logo */}
              <svg width="24" height="24" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#ffffff" />
              </svg>
              <span className="font-semibold text-white ml-2">CrowdVJ</span>
            </Link>
            <nav className="flex items-center gap-4 text-neutral-400">
              <Link href="/control" className="hover:text-white transition-colors">Control</Link>
              <Link href="/archive" className="hover:text-white transition-colors">Archive</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
