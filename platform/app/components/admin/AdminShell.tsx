"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Boxes,
  Building2,
  Database,
  FileInput,
  LayoutDashboard,
  LogOut,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemePreferenceSync } from "@/app/components/theme/ThemePreferenceSync";
import type { CurrentProfile } from "@/lib/platform.types";
import { createClient } from "@/utils/supabase/client";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/organisations", label: "Organisations", icon: Building2 },
  { href: "/admin/suppliers", label: "Suppliers", icon: Store },
  { href: "/admin/catalogue", label: "Catalogue", icon: Database },
  { href: "/admin/imports", label: "Imports", icon: FileInput },
];

export function AdminShell({
  children,
  profile,
}: {
  children: ReactNode;
  profile: CurrentProfile;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const displayName = profile.fullName || profile.email || "Admin";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A";

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background text-on-surface lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      <ThemePreferenceSync themePreference={profile.themePreference} />
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[300px] border-r border-outline-variant/60 bg-surface-container-lowest/95 p-5 shadow-[var(--shadow-card)] backdrop-blur-xl lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-[var(--shadow-cta)]">
            <Boxes size={21} strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-xl font-extrabold tracking-tight text-primary">
              Admin
            </p>
            <p className="text-xs font-semibold text-on-surface-variant">
              ShowCrafter control
            </p>
          </div>
        </div>

        <nav className="space-y-1">
          {ADMIN_LINKS.map((link) => {
            const Icon = link.icon;
            const active =
              pathname === link.href ||
              (link.href !== "/admin" && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55",
                  active
                    ? "bg-primary-container text-on-primary-container shadow-[var(--shadow-cta)]"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                )}
              >
                <Icon size={17} strokeWidth={1.9} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 border-t border-outline-variant/50 pt-4">
          <Link
            href="/dashboard"
            prefetch
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/45 text-sm font-bold text-primary transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
          >
            <ArrowLeft size={16} strokeWidth={1.9} />
            Back to app
          </Link>
          <Link
            href="/settings/profile"
            prefetch
            className="flex items-center gap-3 rounded-xl border border-outline-variant/45 bg-surface-container-low p-3 transition-colors hover:border-primary/30 hover:bg-surface-container"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-tertiary/20 bg-tertiary/12 text-sm font-bold text-tertiary">
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-on-surface">
                {displayName}
              </span>
              <span className="block truncate text-xs text-on-surface-variant">
                {profile.roles.join(", ")}
              </span>
            </span>
            <Settings className="ml-auto text-on-surface-variant" size={16} />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant/45 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
          >
            <LogOut size={16} strokeWidth={1.9} />
            Logout
          </button>
        </div>
      </aside>

      <header className="fixed top-0 z-40 w-full border-b border-outline-variant/50 bg-surface/90 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="text-sm font-bold text-primary">
            Back to app
          </Link>
          <span className="font-extrabold text-on-surface">Admin</span>
          <Link href="/settings/profile" aria-label="Settings">
            <Settings size={20} />
          </Link>
        </div>
      </header>

      <main className="min-w-0 px-5 pb-20 pt-24 sm:px-8 lg:col-start-2 lg:px-12 lg:pt-10">
        <div className="mx-auto w-full max-w-[1480px]">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-outline-variant/50 bg-surface/95 p-2 backdrop-blur-xl lg:hidden">
        {ADMIN_LINKS.map((link) => {
          const Icon = link.icon;
          const active =
            pathname === link.href ||
            (link.href !== "/admin" && pathname?.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex h-11 flex-col items-center justify-center gap-1 rounded-lg text-[9px] font-bold",
                active
                  ? "bg-primary-container text-on-primary-container shadow-[var(--shadow-cta)]"
                  : "text-on-surface-variant",
              )}
            >
              <Icon size={15} />
              <span className="max-w-full truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
