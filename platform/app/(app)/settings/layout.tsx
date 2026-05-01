import type { ReactNode } from "react";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { SettingsTabs } from "./SettingsTabs";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="space-y-7"
      aria-label="Personal details Notifications Billing Security"
    >
      <AppPageHeader title="Account settings" />

      <SettingsTabs />

      <div className="mx-auto max-w-4xl">{children}</div>
    </div>
  );
}
