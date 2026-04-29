import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/app/AppShell";
import { getCurrentUserId } from "@/lib/current-user.server";

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
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
