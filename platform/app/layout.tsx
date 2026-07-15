/** Root Next.js layout; injects fonts, the theme provider, and global styles for every route. */

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './components/theme/ThemeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'ShowCrafter | Firework show planning',
  description:
    'Build a catalogue-linked firework cue timeline, preview the show, and review its shopping list.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.className} ${geistSans.variable} ${geistMono.variable} bg-background text-on-surface overflow-x-hidden`}
        style={{ fontFamily: geistSans.style.fontFamily }}
      >
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
