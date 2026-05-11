import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { requirePermission } from "@/lib/admin.server";
import { measureServerTask } from "@/lib/perf.server";

export const dynamic = "force-dynamic";

export default async function AdminRouteGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await measureServerTask("admin-layout:requirePermission", () =>
    requirePermission("admin.view"),
  );
  if (!profile) redirect("/dashboard");

  return <AdminShell profile={profile}>{children}</AdminShell>;
}
