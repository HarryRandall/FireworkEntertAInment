"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Boxes,
  Gauge,
  LogOut,
  Menu,
  PlusCircle,
  Star,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Container } from "@/app/components/ui/Container";
import { ThemePreferenceSync } from "@/app/components/theme/ThemePreferenceSync";
import { createClient } from "@/utils/supabase/client";
import type { CurrentProfile, PermissionKey } from "@/lib/platform.types";

type AppNavLink = {
  href: string;
  label: string;
  icon: typeof Gauge;
  permission?: PermissionKey;
};

const APP_LINKS: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/shows/new", label: "New Show", icon: PlusCircle },
  { href: "/library", label: "Show Library", icon: Star },
  { href: "/admin", label: "Admin", icon: Shield, permission: "admin.view" },
];

type AppShellProps = {
  children: ReactNode;
  containerWidth?: "default" | "wide";
  profile?: CurrentProfile | null;
};

export function AppShell({
  children,
  containerWidth = "default",
  profile,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const permissions = new Set(profile?.permissions ?? []);
  const visibleLinks = APP_LINKS.filter(
    (link) => !link.permission || permissions.has(link.permission),
  );

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const displayName = profile?.fullName || profile?.email || "Account";
  const secondaryLine = (profile?.roles ?? ["user"]).join(", ");
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SC";

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const renderNavLinks = (onClick?: () => void) =>
    visibleLinks.map((link) => {
      const Icon = link.icon;
      const active =
        pathname === link.href ||
        (link.href !== "/" && pathname?.startsWith(link.href));
      return (
        <Link
          key={link.href}
          href={link.href}
          prefetch
          onClick={onClick}
          className={cn(
            "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55",
            active
              ? "bg-primary-container text-on-primary-container shadow-[var(--shadow-cta)]"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
          )}
        >
          <Icon size={17} strokeWidth={1.85} />
          {link.label}
        </Link>
      );
    });

  const profileCard = (
    <Link
      href="/settings/profile"
      prefetch
      onClick={() => setDrawerOpen(false)}
      className="flex items-center gap-3 rounded-xl border border-outline-variant/45 bg-surface-container-low p-3 transition-colors hover:border-primary/30 hover:bg-surface-container"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-tertiary/20 bg-tertiary/12 text-sm font-bold text-tertiary">
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-on-surface">
          {displayName}
        </span>
        {secondaryLine ? (
          <span className="block truncate text-xs text-on-surface-variant">
            {secondaryLine}
          </span>
        ) : null}
      </span>
    </Link>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant/45 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
    >
      <LogOut size={16} strokeWidth={1.85} />
      Logout
    </button>
  );

  return (
    <div className="min-h-screen bg-background text-on-surface lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <ThemePreferenceSync themePreference={profile?.themePreference} />
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[280px] border-r border-outline-variant/60 bg-surface-container-lowest/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-xl lg:flex lg:flex-col">
        <Link
          href="/dashboard"
          prefetch={false}
          className="mb-8 flex items-center gap-3 px-2 text-xl font-semibold tracking-tight text-primary"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 shadow-[var(--shadow-cta)]">
            <Boxes size={20} strokeWidth={1.8} />
          </span>
          ShowCrafter
        </Link>

        <nav className="space-y-1">{renderNavLinks()}</nav>

        <div className="mt-auto space-y-3 border-t border-outline-variant/50 pt-4">
          {profileCard}
          {logoutButton}
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="fixed top-0 z-40 w-full border-b border-outline-variant/50 bg-surface/90 backdrop-blur-xl lg:hidden">
          <Container className="flex h-16 items-center justify-between">
            <Link
              href="/dashboard"
              prefetch={false}
              className="flex items-center gap-2 text-xl font-semibold tracking-tight text-primary"
            >
              <Boxes size={20} strokeWidth={1.8} />
              ShowCrafter
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/45 bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              <Menu size={20} strokeWidth={1.85} />
            </button>
          </Container>
        </header>

        <main className="pt-24 pb-16 lg:pt-10">
          <Container width={containerWidth}>{children}</Container>
        </main>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 h-full w-full cursor-default bg-background/70 backdrop-blur-sm"
            />
            <aside className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col border-r border-outline-variant/60 bg-surface-container-lowest p-4 shadow-[var(--shadow-card)]">
              <div className="mb-6 flex items-center justify-between">
                <Link
                  href="/dashboard"
                  prefetch={false}
                  className="flex items-center gap-2 text-lg font-semibold tracking-tight text-primary"
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 shadow-[var(--shadow-cta)]">
                    <Boxes size={18} strokeWidth={1.8} />
                  </span>
                  ShowCrafter
                </Link>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/45 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                >
                  <X size={18} strokeWidth={1.85} />
                </button>
              </div>

              <nav className="space-y-1">
                {renderNavLinks(() => setDrawerOpen(false))}
              </nav>

              <div className="mt-auto space-y-3 border-t border-outline-variant/50 pt-4">
                {profileCard}
                {logoutButton}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
