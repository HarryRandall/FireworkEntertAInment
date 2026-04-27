import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/app/AppShell";
import { createClient } from "@/utils/supabase/server";

// Authenticated routes always need a fresh session check.
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Defense in depth: middleware already redirects unauthenticated users,
  // but we re-check here so any cookie-tampering or middleware misconfig
  // never leaks the authenticated shell.
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
