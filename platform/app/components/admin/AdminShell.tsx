"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Boxes,
  Database,
  FileInput,
  LayoutDashboard,
  Menu,
  Settings,
  Store,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemePreferenceSync } from "@/app/components/theme/ThemePreferenceSync";
import { uiStyles } from "@/app/components/ui/styles";
import type { CurrentProfile } from "@/lib/platform.types";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
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
  const DRAWER_EXIT_MS = 280;
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const displayName = profile.fullName || profile.email || "Admin";
  const secondaryLine = profile.fullName && profile.email ? profile.email : "Platform admin";
  const profileHref = `/settings/profile?returnTo=${encodeURIComponent(pathname || "/admin")}`;
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A";

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

  const brand = (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/55 bg-surface text-primary">
        <Boxes size={20} strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-xl font-semibold tracking-tight text-on-surface">
          ShowCrafter
        </p>
        <p className="text-xs font-semibold text-on-surface-variant">
          Admin
        </p>
      </div>
    </div>
  );

  const renderNavLinks = (onClick?: () => void) =>
    ADMIN_LINKS.map((link) => {
      const Icon = link.icon;
      const active =
        pathname === link.href ||
        (link.href !== "/admin" && pathname?.startsWith(link.href));
      return (
        <Link
          key={link.href}
          href={link.href}
          prefetch
          onClick={onClick}
          className={cn(
            uiStyles.action.navBase,
            "font-bold",
            active ? uiStyles.action.navActive : uiStyles.action.navInactive,
          )}
        >
          <Icon size={17} strokeWidth={1.9} />
          {link.label}
        </Link>
      );
    });

  const profileCard = (
    <Link
      href={profileHref}
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
        <span className="block truncate text-xs text-on-surface-variant">
          {secondaryLine}
        </span>
      </span>
      <Settings className="ml-auto text-on-surface-variant" size={16} />
    </Link>
  );

  return (
    <div className="min-h-screen bg-background text-on-surface lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <ThemePreferenceSync themePreference={profile.themePreference} />
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[280px] border-r border-outline-variant/60 bg-surface-container-lowest p-4 shadow-[var(--shadow-card)] lg:flex lg:flex-col">
        <div className="mb-8">{brand}</div>

        <nav className="space-y-1">{renderNavLinks()}</nav>
        <Link
          href="/dashboard"
          prefetch
          className="focus-glow-action mt-4 flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-on-surface-variant transition-colors focus:outline-none focus-visible:outline-none hover:bg-surface-container-high hover:text-on-surface"
        >
          <ArrowLeft size={16} strokeWidth={1.9} />
          Back to app
        </Link>

        <div className="mt-auto pt-4">{profileCard}</div>
      </aside>

      <header className="fixed top-0 z-40 w-full border-b border-outline-variant/50 bg-surface/92 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-on-surface"
          >
            <Boxes size={18} strokeWidth={1.85} />
            ShowCrafter
          </Link>
          <button
            type="button"
            onClick={openDrawer}
            aria-label="Open admin navigation"
            aria-expanded={drawerOpen}
            className="focus-glow-action flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/45 bg-surface text-on-surface transition-colors focus:outline-none focus-visible:outline-none hover:bg-surface-container-high"
          >
            <Menu size={20} strokeWidth={1.85} />
          </button>
        </div>
      </header>

      <main className="min-w-0 bg-background px-6 pb-16 pt-0 sm:px-8 lg:col-start-2 lg:px-12">
        <div className="w-full">{children}</div>
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
            aria-label="Close admin navigation"
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
              <div className="mb-6 flex items-center justify-between gap-3">
                {brand}
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Close admin navigation"
                  className="focus-glow-action flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/45 text-on-surface-variant transition-colors focus:outline-none focus-visible:outline-none hover:bg-surface-container-high hover:text-on-surface"
                >
                  <X size={18} strokeWidth={1.85} />
                </button>
              </div>

              <nav className="space-y-1">
                {renderNavLinks(closeDrawer)}
              </nav>
              <Link
                href="/dashboard"
                prefetch
                onClick={closeDrawer}
                className="focus-glow-action mt-4 flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-on-surface-variant transition-colors focus:outline-none focus-visible:outline-none hover:bg-surface-container-high hover:text-on-surface"
              >
                <ArrowLeft size={16} strokeWidth={1.9} />
                Back to app
              </Link>

              <div className="mt-auto pt-4">{profileCard}</div>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}
