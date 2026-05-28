'use client';

/**
 * AppShell - top-level chrome (sidebar + mobile sheet) for the
 * authenticated `/app` route group. Adapts navigation based on the
 * current pathname and the signed-in profile's roles.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Gauge,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Settings,
  Sparkles,
  Star,
  Shield,
  ShieldCheck,
  Bell,
  CreditCard,
  UserRound,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ThemePreferenceSync } from '@/app/components/theme/ThemePreferenceSync';
import type { CurrentProfile, PermissionKey } from '@/lib/admin.types';

type AppNavLink = {
  href: string;
  label: string;
  icon: typeof Gauge;
  permission?: PermissionKey;
};

const APP_LINKS: AppNavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/shows/new', label: 'New show', icon: PlusCircle },
  { href: '/library', label: 'Library', icon: Star },
  { href: '/admin', label: 'Admin', icon: Shield, permission: 'admin.view' },
];

const SETTINGS_LINKS = [
  { href: '/settings/profile', label: 'Personal details', icon: UserRound },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings/security', label: 'Security', icon: ShieldCheck },
] as const;

type AppShellProps = {
  children: ReactNode;
  containerWidth?: 'default' | 'wide' | 'fluid';
  profile?: CurrentProfile | null;
};

const navBase =
  "relative flex h-8 items-center gap-2 rounded-lg px-2 pl-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)] before:absolute before:left-1 before:top-1.5 before:h-5 before:w-0.5 before:rounded-full before:bg-transparent before:content-['']";
const navActive =
  'bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-emphasis)] before:bg-[color:var(--color-accent)]';
const navInactive =
  'text-[color:var(--color-content-default)] hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)]';
const sidebarCollapsedStorageKey = 'showcrafter:sidebar-collapsed';

const readSidebarCollapsedPreference = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(sidebarCollapsedStorageKey) === 'true';
  } catch {
    return false;
  }
};

export function AppShell({ children, profile }: AppShellProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const effectivePath = pendingHref ?? pathname;
  const inSettings = effectivePath?.startsWith('/settings');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTransitionReady, setSidebarTransitionReady] = useState(false);
  const permissions = new Set(profile?.permissions ?? []);
  const visibleLinks = APP_LINKS.filter(
    (link) => !link.permission || permissions.has(link.permission),
  );

  const displayName = profile?.fullName || profile?.email || 'Account';
  const secondaryLine = profile?.fullName && profile?.email ? profile.email : '';
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'SC';

  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    closeDrawer();
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    setSidebarCollapsed(readSidebarCollapsedPreference());
    const frame = window.requestAnimationFrame(() => setSidebarTransitionReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        window.localStorage.setItem(sidebarCollapsedStorageKey, String(next));
      } catch {
        // Ignore storage errors; the button should still work for this session.
      }
      return next;
    });
  };

  const renderSidebarTooltip = (
    content: ReactNode,
    label: string,
    collapsed: boolean,
    key?: string,
  ) =>
    collapsed ? (
      <Tooltip key={key}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="bg-[color:var(--color-bg-inverted)] text-[color:var(--color-content-inverted)]"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    ) : (
      content
    );

  const collapsedNavClasses =
    'h-8 w-8 min-w-8 self-center justify-center px-0 pl-0 before:left-0 before:top-1.5 before:h-5';

  const renderNavLinks = (onClick?: () => void, collapsed = sidebarCollapsed) =>
    visibleLinks.map((link) => {
      const Icon = link.icon;
      const active =
        effectivePath === link.href || (link.href !== '/' && effectivePath?.startsWith(link.href));
      const item = (
        <Link
          key={link.href}
          href={link.href}
          prefetch
          onClick={(event) => {
            if (
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey &&
              event.button === 0
            ) {
              setPendingHref(link.href);
            }
            onClick?.();
          }}
          aria-label={collapsed ? link.label : undefined}
          className={cn(
            navBase,
            active ? navActive : navInactive,
            collapsed && collapsedNavClasses,
          )}
        >
          <Icon className="shrink-0" size={16} strokeWidth={2} />
          <span className={cn('truncate', collapsed && 'sr-only')}>{link.label}</span>
        </Link>
      );
      return renderSidebarTooltip(item, link.label, collapsed, link.href);
    });

  const renderSettingsLinks = (onClick?: () => void, collapsed = sidebarCollapsed) =>
    SETTINGS_LINKS.map((link) => {
      const Icon = link.icon;
      const active = effectivePath === link.href || effectivePath?.startsWith(link.href + '/');
      const item = (
        <Link
          key={link.href}
          href={link.href}
          prefetch
          onClick={(event) => {
            if (
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey &&
              event.button === 0
            ) {
              setPendingHref(link.href);
            }
            onClick?.();
          }}
          aria-label={collapsed ? link.label : undefined}
          className={cn(
            navBase,
            active ? navActive : navInactive,
            collapsed && collapsedNavClasses,
          )}
        >
          <Icon className="shrink-0" size={16} strokeWidth={2} />
          <span className={cn('truncate', collapsed && 'sr-only')}>{link.label}</span>
        </Link>
      );
      return renderSidebarTooltip(item, link.label, collapsed, link.href);
    });

  const renderBrand = (collapsed = false) => {
    if (collapsed) {
      return (
        <button
          type="button"
          aria-label="Expand sidebar"
          aria-pressed={sidebarCollapsed}
          onClick={toggleSidebar}
          className="group flex h-9 w-9 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
        >
          <span className="brand-logo-mark relative h-8 w-8 overflow-hidden rounded-lg">
            <Sparkles
              className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"
              size={15}
              strokeWidth={2.2}
            />
            <PanelLeftOpen
              className="absolute opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              size={16}
              strokeWidth={2}
            />
          </span>
        </button>
      );
    }

    const brand = (
      <Link
        href="/dashboard"
        prefetch
        className="flex items-center gap-2 px-1.5 text-sm font-semibold tracking-tight text-[color:var(--color-content-emphasis)]"
      >
        <span className="brand-logo-mark h-7 w-7 rounded-md">
          <Sparkles size={14} strokeWidth={2.2} />
        </span>
        <span>ShowCrafter</span>
      </Link>
    );

    return brand;
  };

  const renderProfileCard = (collapsed = false) => {
    const profileCard = (
      <Link
        href="/settings/profile"
        prefetch
        onClick={closeDrawer}
        aria-label={collapsed ? 'Profile settings' : undefined}
        className={cn(
          'group flex items-center rounded-lg transition-colors hover:bg-[color:var(--color-bg-subtle)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]',
          collapsed
            ? 'h-8 w-8 min-w-8 justify-center self-center bg-transparent p-0'
            : 'gap-2.5 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-2',
        )}
      >
        <span
          className={cn(
            'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-xs font-medium text-[color:var(--color-content-default)]',
            collapsed && 'h-8 w-8 rounded-lg',
          )}
        >
          <span className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0">
            {initials}
          </span>
          <Settings
            className={cn(
              'absolute opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
              !collapsed && 'hidden',
            )}
            size={16}
          />
        </span>
        <span className={cn('min-w-0 flex-1', collapsed && 'sr-only')}>
          <span className="block truncate text-sm font-medium text-[color:var(--color-content-emphasis)]">
            {displayName}
          </span>
          {secondaryLine ? (
            <span className="block truncate text-xs text-[color:var(--color-content-subtle)]">
              {secondaryLine}
            </span>
          ) : null}
        </span>
        <Settings
          className={cn('shrink-0 text-[color:var(--color-content-subtle)]', collapsed && 'hidden')}
          size={14}
        />
      </Link>
    );

    return renderSidebarTooltip(profileCard, 'Profile settings', collapsed);
  };

  const settingsBackLink = (onClick?: () => void, collapsed = sidebarCollapsed) => {
    const link = (
      <Link
        href="/dashboard"
        prefetch
        onClick={onClick}
        aria-label={collapsed ? 'Back to app' : undefined}
        className={cn(
          'flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]',
          collapsed && 'h-8 w-8 min-w-8 justify-center self-center px-0',
        )}
      >
        <ArrowLeft className="shrink-0" size={14} />
        <span className={cn(collapsed && 'sr-only')}>Back to app</span>
      </Link>
    );

    return renderSidebarTooltip(link, 'Back to app', collapsed);
  };

  const navContent = inSettings ? renderSettingsLinks() : renderNavLinks();
  const mobileNavContent = inSettings
    ? renderSettingsLinks(closeDrawer, false)
    : renderNavLinks(closeDrawer, false);
  const mobileDescription = inSettings
    ? 'Jump between personal details, notifications, billing, and security.'
    : 'Jump between dashboard, new show, library, and admin sections.';
  const profileFooter = inSettings ? null : (
    <div className="mt-auto pt-3">{renderProfileCard(sidebarCollapsed)}</div>
  );
  const sidebarToggleLabel = 'Collapse sidebar';

  return (
    <div className="min-h-screen bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-emphasis)] lg:p-2">
      <ThemePreferenceSync themePreference={profile?.themePreference} />
      <div
        className={cn(
          'lg:grid lg:gap-2',
          sidebarTransitionReady &&
            'lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out',
          sidebarCollapsed
            ? 'lg:grid-cols-[40px_minmax(0,1fr)]'
            : 'lg:grid-cols-[216px_minmax(0,1fr)]',
        )}
      >
        {/* Sidebar */}
        <aside
          className={cn(
            'hidden lg:sticky lg:top-2 lg:flex lg:h-[calc(100vh-1rem)] lg:flex-col lg:gap-5 lg:p-2',
          )}
        >
          <div
            className={cn(
              'pt-2',
              sidebarCollapsed ? 'flex justify-center' : 'flex items-center justify-between gap-1',
            )}
          >
            {renderBrand(sidebarCollapsed)}
            {!sidebarCollapsed ? (
              <button
                type="button"
                aria-label={sidebarToggleLabel}
                aria-pressed={false}
                onClick={toggleSidebar}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
              >
                <PanelLeftClose size={18} strokeWidth={2} />
              </button>
            ) : null}
          </div>
          <nav className="flex w-full flex-col gap-0.5">{navContent}</nav>
          {inSettings ? (
            <div
              className={cn(
                'border-t border-[color:var(--color-border-subtle)] pt-3',
                sidebarCollapsed && 'flex justify-center',
              )}
            >
              {settingsBackLink()}
            </div>
          ) : null}
          {profileFooter}
        </aside>

        {/* Content panel */}
        <div className="min-w-0 bg-[color:var(--color-bg-default)] lg:rounded-xl lg:border lg:border-[color:var(--color-border-subtle)]">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] px-4 py-3 lg:hidden">
            {renderBrand(false)}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open navigation menu"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-default)] transition-colors hover:bg-[color:var(--color-bg-muted)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                >
                  <Menu size={18} />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                showCloseButton={false}
                className="!max-w-[216px] border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-4 data-[side=left]:!w-[min(86vw,216px)] lg:hidden"
              >
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <SheetDescription className="sr-only">{mobileDescription}</SheetDescription>
                <div className="mb-6 flex items-center justify-between">
                  {renderBrand(false)}
                  <SheetClose asChild>
                    <button
                      type="button"
                      aria-label="Close navigation menu"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)]"
                    >
                      <X size={18} />
                    </button>
                  </SheetClose>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <nav className="flex flex-col gap-0.5">{mobileNavContent}</nav>
                  {inSettings ? (
                    <div className="mt-4 border-t border-[color:var(--color-border-subtle)] pt-3">
                      {settingsBackLink(closeDrawer, false)}
                    </div>
                  ) : null}
                </ScrollArea>

                {!inSettings ? (
                  <div className="mt-auto pt-4">{renderProfileCard(false)}</div>
                ) : null}
              </SheetContent>
            </Sheet>
          </header>

          <main className="px-6 py-6 sm:px-8 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
