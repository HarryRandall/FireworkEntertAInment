"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CreditCard, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

const SETTINGS_LINKS = [
  { href: "/settings/profile", label: "Personal details", icon: UserRound },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {SETTINGS_LINKS.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href || pathname?.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55",
              active
                ? "bg-primary-container text-on-primary-container shadow-[var(--shadow-cta)]"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            <Icon size={16} strokeWidth={1.85} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
