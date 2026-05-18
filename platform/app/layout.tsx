import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

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
      <body className="font-body bg-background text-on-surface overflow-x-hidden">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
