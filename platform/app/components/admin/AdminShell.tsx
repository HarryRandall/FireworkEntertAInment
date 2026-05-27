'use client';

/**
 * AdminShell - top-level chrome (sidebar + mobile sheet) for the
 * `/admin` route group. Mirrors the authenticated app chrome but exposes admin-only
 * destinations and is gated upstream by RBAC checks in server
 * components / middleware.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Database,
  FileInput,
  LayoutDashboard,
  Menu,
  Rocket,
  Settings,
  Sparkles,
  Store,
  Users,
  X,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ThemePreferenceSync } from '@/app/components/theme/ThemePreferenceSync';
import type { CurrentProfile } from '@/lib/admin.types';

const ADMIN_LINKS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/suppliers', label: 'Suppliers', icon: Store },
  { href: '/admin/catalogue', label: 'Catalogue', icon: Database },
  { href: '/admin/fireworks', label: 'Fireworks', icon: Rocket },
  { href: '/admin/effects', label: 'Effects', icon: Sparkles },
  { href: '/admin/imports', label: 'Imports', icon: FileInput },
];

const navBase =
  "relative flex h-8 items-center gap-2 rounded-lg px-2 pl-3 text-sm font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)] before:absolute before:left-1 before:top-1.5 before:h-5 before:w-0.5 before:rounded-full before:bg-transparent before:content-['']";
const navActive =
  'bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-emphasis)] before:bg-[color:var(--color-accent)]';
const navInactive =
  'text-[color:var(--color-content-default)] hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)]';

export function AdminShell({
  children,
  profile,
}: {
  children: ReactNode;
  profile: CurrentProfile;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const displayName = profile.fullName || profile.email || 'Admin';
  const secondaryLine = profile.fullName && profile.email ? profile.email : 'Platform admin';
  const profileHref = '/settings/profile';
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'A';

  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    closeDrawer();
  }, [pathname]);

  const brand = (
    <Link
      href="/admin"
      prefetch
      className="flex items-center gap-2 px-2 text-sm font-semibold tracking-tight text-[color:var(--color-content-emphasis)]"
    >
      <span className="brand-logo-mark h-7 w-7 rounded-md">
        <Sparkles size={14} strokeWidth={2.2} />
      </span>
      <span className="flex flex-col leading-tight">
        <span>ShowCrafter</span>
        <span className="text-[10px] font-medium tracking-wide text-[color:var(--color-content-subtle)] uppercase">
          Admin
        </span>
      </span>
    </Link>
  );

  const renderNavLinks = (onClick?: () => void) =>
    ADMIN_LINKS.map((link) => {
      const Icon = link.icon;
      const active =
        pathname === link.href || (link.href !== '/admin' && pathname?.startsWith(link.href));
      return (
        <Link
          key={link.href}
          href={link.href}
          prefetch
          onClick={onClick}
          className={cn(navBase, active ? navActive : navInactive)}
        >
          <Icon size={16} strokeWidth={2} />
          {link.label}
        </Link>
      );
    });

  const profileCard = (
    <Link
      href={profileHref}
      prefetch
      onClick={closeDrawer}
      className="flex items-center gap-2.5 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-2 transition-colors hover:bg-[color:var(--color-bg-subtle)]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-xs font-medium text-[color:var(--color-content-default)]">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[color:var(--color-content-emphasis)]">
          {displayName}
        </span>
        <span className="block truncate text-xs text-[color:var(--color-content-subtle)]">
          {secondaryLine}
        </span>
      </span>
      <Settings className="shrink-0 text-[color:var(--color-content-subtle)]" size={14} />
    </Link>
  );

  const backToApp = (onClick?: () => void) => (
    <Link
      href="/dashboard"
      prefetch
      onClick={onClick}
      className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)]"
    >
      <ArrowLeft size={14} />
      Back to app
    </Link>
  );

  return (
    <div className="min-h-screen bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-emphasis)] lg:p-2">
      <ThemePreferenceSync themePreference={profile.themePreference} />
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-2">
        <aside className="hidden lg:sticky lg:top-2 lg:flex lg:h-[calc(100vh-1rem)] lg:flex-col lg:gap-6 lg:p-3">
          <div className="pt-2">{brand}</div>
          <nav className="flex flex-col gap-0.5">{renderNavLinks()}</nav>
          <div className="border-t border-[color:var(--color-border-subtle)] pt-3">
            {backToApp()}
          </div>
          <div className="mt-auto pt-3">{profileCard}</div>
        </aside>

        <div className="flex min-w-0 flex-col bg-[color:var(--color-bg-default)] lg:h-[calc(100vh-1rem)] lg:overflow-hidden lg:rounded-xl lg:border lg:border-[color:var(--color-border-subtle)]">
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] px-4 py-3 lg:hidden">
            {brand}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open admin navigation"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-default)] transition-colors hover:bg-[color:var(--color-bg-muted)]"
                >
                  <Menu size={18} />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                showCloseButton={false}
                className="w-[min(86vw,300px)] border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-4 lg:hidden"
              >
                <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                <SheetDescription className="sr-only">
                  Browse admin tools, then return to the main app.
                </SheetDescription>
                <div className="mb-6 flex items-center justify-between">
                  {brand}
                  <SheetClose asChild>
                    <button
                      type="button"
                      aria-label="Close admin navigation"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)]"
                    >
                      <X size={18} />
                    </button>
                  </SheetClose>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <nav className="flex flex-col gap-0.5">{renderNavLinks(closeDrawer)}</nav>
                  <div className="mt-4 border-t border-[color:var(--color-border-subtle)] pt-3">
                    {backToApp(closeDrawer)}
                  </div>
                </ScrollArea>
                <div className="mt-auto pt-4">{profileCard}</div>
              </SheetContent>
            </Sheet>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-8 lg:px-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
