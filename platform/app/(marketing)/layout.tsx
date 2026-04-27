import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { MarketingNavBar } from "@/app/components/marketing/NavBar";
import { MarketingFooter } from "@/app/components/marketing/Footer";
import { createClient } from "@/utils/supabase/server";

// The nav swaps Log in / Sign up for a Dashboard link when the user is
// authenticated, so we need a fresh session check on every render.
export const dynamic = "force-dynamic";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <MarketingNavBar isAuthenticated={Boolean(user)} />
      <main className="flex-grow pt-16">{children}</main>
      <MarketingFooter />
    </div>
  );
}
