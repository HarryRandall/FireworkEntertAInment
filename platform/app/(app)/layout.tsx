import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/app/AppShell";
import { getCurrentProfile } from "@/lib/platform.server";
import { measureServerTask } from "@/lib/perf.server";

// Authenticated routes always need a fresh session check.
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await measureServerTask("app-layout:getCurrentProfile", () =>
    getCurrentProfile(),
  );
  if (!profile) redirect("/login");

  return <AppShell profile={profile}>{children}</AppShell>;
}
