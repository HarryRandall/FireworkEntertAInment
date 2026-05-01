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
import { cn } from "@/lib/cn";
import { ThemePreferenceSync } from "@/app/components/theme/ThemePreferenceSync";
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
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const brand = (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-[var(--shadow-cta)]">
        <Boxes size={20} strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-xl font-semibold tracking-tight text-primary">
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
    });

  const profileCard = (
    <Link
      href={profileHref}
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
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[280px] border-r border-outline-variant/60 bg-surface-container-lowest/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-xl lg:flex lg:flex-col">
        <div className="mb-8">{brand}</div>

        <nav className="space-y-1">{renderNavLinks()}</nav>
        <Link
          href="/dashboard"
          prefetch
          className="mt-4 flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
        >
          <ArrowLeft size={16} strokeWidth={1.9} />
          Back to app
        </Link>

        <div className="mt-auto border-t border-outline-variant/50 pt-4">{profileCard}</div>
      </aside>

      <header className="fixed top-0 z-40 w-full border-b border-outline-variant/50 bg-surface/90 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-primary"
          >
            <Boxes size={18} strokeWidth={1.85} />
            ShowCrafter
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open admin navigation"
            aria-expanded={drawerOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/45 bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
          >
            <Menu size={20} strokeWidth={1.85} />
          </button>
        </div>
      </header>

      <main className="min-w-0 px-5 pb-16 pt-24 sm:px-8 lg:col-start-2 lg:px-12 lg:pt-10">
        <div className="mx-auto w-full max-w-[1480px]">{children}</div>
      </main>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close admin navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-background/70 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col border-r border-outline-variant/60 bg-surface-container-lowest p-4 shadow-[var(--shadow-card)]">
            <div className="mb-6 flex items-center justify-between gap-3">
              {brand}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close admin navigation"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/45 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <X size={18} strokeWidth={1.85} />
              </button>
            </div>

            <nav className="space-y-1">
              {renderNavLinks(() => setDrawerOpen(false))}
            </nav>
            <Link
              href="/dashboard"
              prefetch
              onClick={() => setDrawerOpen(false)}
              className="mt-4 flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
            >
              <ArrowLeft size={16} strokeWidth={1.9} />
              Back to app
            </Link>

            <div className="mt-auto border-t border-outline-variant/50 pt-4">{profileCard}</div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
