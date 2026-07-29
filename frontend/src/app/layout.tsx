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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-neutral-200 min-h-screen flex`}
      >
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-white/10 bg-[#050505] flex flex-col h-screen sticky top-0 shrink-0 hidden md:flex">
          <div className="h-16 flex items-center px-6 border-b border-white/10">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <svg width="24" height="24" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#ffffff" />
              </svg>
              <span className="font-semibold text-white tracking-wide">CrowdVJ</span>
            </Link>
          </div>
          <nav className="flex-1 px-4 py-6 flex flex-col gap-1 text-sm font-medium">
            <Link href="/control" className="px-3 py-2.5 rounded-md hover:bg-white/5 text-neutral-400 hover:text-white transition-all">Control</Link>
            <Link href="/archive" className="px-3 py-2.5 rounded-md hover:bg-white/5 text-neutral-400 hover:text-white transition-all">Archive</Link>
            <Link href="/render" className="px-3 py-2.5 rounded-md hover:bg-white/5 text-neutral-400 hover:text-white transition-all">Render</Link>
          </nav>
        </aside>

        {/* Mobile Header (fallback) */}
        <header className="md:hidden sticky top-0 z-50 flex items-center h-14 px-4 border-b border-white/10 bg-black/80 backdrop-blur-md w-full">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <svg width="20" height="20" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#ffffff" />
            </svg>
            <span className="font-semibold text-white">CrowdVJ</span>
          </Link>
          <nav className="ml-auto flex gap-3 text-xs text-neutral-400">
            <Link href="/control">Control</Link>
            <Link href="/archive">Archive</Link>
            <Link href="/render">Render</Link>
          </nav>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-screen min-w-0">
          {children}
        </main>
      </body>
    </html>
  );
}
