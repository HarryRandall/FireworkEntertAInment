import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-body bg-background text-on-surface overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
