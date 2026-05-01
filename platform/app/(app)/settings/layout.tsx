import type { ReactNode } from "react";
import { SettingsTabs } from "./SettingsTabs";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-7">
      <header className="border-b border-outline-variant/55 pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
          Account settings
        </h1>
      </header>

      <SettingsTabs />

      <div className="mx-auto max-w-4xl">{children}</div>
    </div>
  );
}
