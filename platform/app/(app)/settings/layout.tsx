import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, CreditCard, ShieldCheck, UserRound } from "lucide-react";

const SETTINGS_LINKS = [
  { href: "/settings/profile", label: "Personal details", icon: UserRound },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="border-b border-outline-variant/20 pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
          Account settings
        </h1>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-outline-variant/15 pb-3">
        {SETTINGS_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              <Icon size={16} strokeWidth={1.8} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
