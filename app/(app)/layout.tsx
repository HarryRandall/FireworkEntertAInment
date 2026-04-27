import type { ReactNode } from "react";
import { AppShell } from "@/app/components/app/AppShell";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
