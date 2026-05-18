"use client";

import { usePathname } from "next/navigation";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";

const SETTINGS_COPY = {
  "/settings/profile": {
    title: "Personal details",
    description: "Keep your account details, contact info, and interface theme up to date.",
  },
  "/settings/notifications": {
    title: "Notifications",
    description: "Choose which product, supplier, and show updates should reach you.",
  },
  "/settings/billing": {
    title: "Billing",
    description: "Review your plan, payment setup, and invoice history.",
  },
  "/settings/security": {
    title: "Security",
    description: "Manage password changes and other account access controls.",
  },
} as const;

export function SettingsPageHeader() {
  const pathname = usePathname();
  const copy =
    SETTINGS_COPY[pathname as keyof typeof SETTINGS_COPY] ?? SETTINGS_COPY["/settings/profile"];

  return <AppPageHeader title={copy.title} description={copy.description} />;
}
