import type { ReactNode } from "react";
import { MarketingNavBar } from "@/app/components/marketing/NavBar";
import { MarketingFooter } from "@/app/components/marketing/Footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <MarketingNavBar />
      <main className="flex-grow pt-16">{children}</main>
      <MarketingFooter />
    </div>
  );
}
