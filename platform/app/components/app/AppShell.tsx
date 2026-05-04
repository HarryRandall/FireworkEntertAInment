"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Boxes,
  Gauge,
  Menu,
  PlusCircle,
  Star,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "@/app/components/ui/Container";
import { uiStyles } from "@/app/components/ui/styles";
import { ThemePreferenceSync } from "@/app/components/theme/ThemePreferenceSync";
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
  containerWidth?: "default" | "wide" | "fluid";
  profile?: CurrentProfile | null;
};

export function AppShell({
  children,
  containerWidth = "fluid",
  profile,
}: AppShellProps) {
  const DRAWER_EXIT_MS = 280;
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const permissions = new Set(profile?.permissions ?? []);
  const visibleLinks = APP_LINKS.filter(
    (link) => !link.permission || permissions.has(link.permission),
  );

  const displayName = profile?.fullName || profile?.email || "Account";
  const secondaryLine =
    profile?.fullName && profile?.email ? profile.email : "";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SC";

  const openDrawer = () => {
    setDrawerMounted(true);
    window.requestAnimationFrame(() => {
      setDrawerOpen(true);
    });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  useEffect(() => {
    closeDrawer();
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen) return;
    const timeout = window.setTimeout(() => setDrawerMounted(false), DRAWER_EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerMounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerMounted]);

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
            uiStyles.action.navBase,
            active ? uiStyles.action.navActive : uiStyles.action.navInactive,
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
      onClick={closeDrawer}
      className="flex items-center gap-3 rounded-xl border border-outline-variant/45 bg-surface p-3 transition-colors hover:bg-surface-container-high"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant/55 bg-surface-container-high text-sm font-bold text-on-surface-variant">
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

  return (
    <div className="min-h-screen bg-background text-on-surface lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <ThemePreferenceSync themePreference={profile?.themePreference} />
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[280px] border-r border-outline-variant/60 bg-surface-container-lowest p-4 shadow-[var(--shadow-card)] lg:flex lg:flex-col">
        <Link
          href="/dashboard"
          prefetch={false}
          className="mb-8 flex items-center gap-3 px-2 text-xl font-semibold tracking-tight text-on-surface"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/55 bg-surface text-primary">
            <Boxes size={20} strokeWidth={1.8} />
          </span>
          ShowCrafter
        </Link>

        <nav className="space-y-1">{renderNavLinks()}</nav>

        <div className="mt-auto pt-4">
          {profileCard}
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="fixed top-0 z-40 w-full border-b border-outline-variant/50 bg-surface/92 backdrop-blur-xl lg:hidden">
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
              onClick={openDrawer}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              className="focus-glow-action flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/45 bg-surface text-on-surface transition-colors focus:outline-none focus-visible:outline-none hover:bg-surface-container-high"
            >
              <Menu size={20} strokeWidth={1.85} />
            </button>
          </Container>
        </header>

        <main className="pt-0 pb-16">
          <Container width={containerWidth}>{children}</Container>
        </main>

        {drawerMounted ? (
          <div
            className={cn(
              "fixed inset-0 z-50 lg:hidden transition-opacity duration-200 ease-out",
              drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={closeDrawer}
              className={cn(
                "absolute inset-0 h-full w-full cursor-default bg-background/45 backdrop-blur-[2px] transition-opacity duration-200 ease-out",
                drawerOpen ? "opacity-100" : "opacity-0",
              )}
            />
            <div
              className={cn(
                "absolute inset-y-0 left-0 w-[min(86vw,320px)] will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                drawerOpen
                  ? "translate-x-0"
                  : "-translate-x-full",
              )}
            >
              <aside className="flex h-full w-[min(86vw,320px)] flex-col border-r border-outline-variant/60 bg-surface-container-lowest p-4 shadow-[var(--shadow-modal)]">
                <div className="mb-6 flex items-center justify-between">
                  <Link
                    href="/dashboard"
                    prefetch={false}
                    className="flex items-center gap-2 text-lg font-semibold tracking-tight text-on-surface"
                    onClick={closeDrawer}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/55 bg-surface text-primary">
                      <Boxes size={18} strokeWidth={1.8} />
                    </span>
                    ShowCrafter
                  </Link>
                  <button
                    type="button"
                    onClick={closeDrawer}
                    aria-label="Close navigation menu"
                    className="focus-glow-action flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/45 text-on-surface-variant transition-colors focus:outline-none focus-visible:outline-none hover:bg-surface-container-high hover:text-on-surface"
                  >
                    <X size={18} strokeWidth={1.85} />
                  </button>
                </div>

                <nav className="space-y-1">
                  {renderNavLinks(closeDrawer)}
                </nav>

                <div className="mt-auto pt-4">
                  {profileCard}
                </div>
              </aside>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
