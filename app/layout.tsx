import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/theme/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShowCrafter — AI Fireworks Choreography",
  description:
    "Pick a song, set a budget, and let AI choreograph a fireworks show using real products from your local store.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-body bg-background text-on-surface overflow-x-hidden`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
