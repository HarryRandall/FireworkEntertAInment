'use client';

/**
 * AppShell - authenticated workspace chrome built on the shadcn sidebar
 * primitive, with ShowCrafter route permissions and persisted collapse state.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  Bell,
  Box,
  ChevronRight,
  CircleUser,
  CreditCard,
  Download,
  EllipsisVertical,
  Gauge,
  LogOut,
  MessageSquareDot,
  Music4,
  PlusCircle,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ThemePreferenceSync } from '@/app/components/theme/ThemePreferenceSync';
import { ImpersonationBanner } from '@/app/components/app/ImpersonationBanner';
import { useSidebarPreference } from '@/app/components/app/useSidebarPreference';
import { GeneratedAvatar } from '@/app/components/ui/GeneratedAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { PaletteStrip } from '@/app/components/app/ShowSummaryCards';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import {
  featuredTemplateDismissalCookieMaxAge,
  featuredTemplateDismissalCookieName,
  featuredTemplateDismissalDurationMs,
  parseFeaturedTemplateDismissedUntil,
} from '@/lib/featured-template-dismissal';
import type { CurrentProfile, PermissionKey } from '@/lib/admin.types';
import type { ActiveImpersonation } from '@/lib/impersonation.types';
import type { ShowSummaryCard, TemplateSummaryCard, WorkspaceSummary } from '@/lib/show-summary';

type AppNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  badge?: string;
};

const APP_LINKS: AppNavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/shows', label: 'My shows', icon: Music4 },
  { href: '/library', label: 'Explore', icon: Star },
  { href: '/catalogue', label: 'Catalogue', icon: Box },
  { href: '/exports', label: 'Exports', icon: Download },
  { href: '/safety', label: 'Safety', icon: TriangleAlert },
  { href: '/admin', label: 'Admin', icon: Shield, permission: 'admin.view' },
];

const SETTINGS_LINKS: AppNavLink[] = [
  { href: '/settings/profile', label: 'Personal details', icon: UserRound },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings/security', label: 'Security', icon: ShieldCheck },
];

const SETTINGS_BREADCRUMB_LABELS: Record<string, string> = {
  '/settings': 'Settings',
  '/settings/profile': 'Profile',
  '/settings/notifications': 'Notifications',
  '/settings/billing': 'Billing',
  '/settings/security': 'Security',
};

function getFeaturedTemplateAccentStyle(template: TemplateSummaryCard): CSSProperties {
  const [startColour, middleColour] = template.palette.hex;

  return {
    background: `linear-gradient(90deg, ${startColour}, ${middleColour} 54%, var(--sidebar-primary-foreground))`,
  };
}

const SHOW_SUBPAGE_LABELS: Record<string, string> = {
  preview: 'Preview',
  timeline: 'Timeline',
  'shopping-list': 'Shopping list',
  'show-guide': 'Show guide',
  generating: 'Generating',
};

type ShellBreadcrumb = {
  label: string;
  href?: string;
};

type AppShellProps = {
  children: ReactNode;
  containerWidth?: 'default' | 'wide' | 'fluid';
  profile?: CurrentProfile | null;
  impersonation?: ActiveImpersonation | null;
  initialSidebarCollapsed?: boolean;
  hasInitialSidebarCollapsedCookie?: boolean;
  initialFeaturedTemplateDismissedUntil?: number | null;
};

type ProfileSummary = {
  displayName: string;
  secondaryLine: string;
};

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0
  );
}

function isActivePath(pathname: string | null, href: string) {
  if (href === '/shows') {
    return (
      pathname === '/shows' || Boolean(pathname?.startsWith('/shows/') && pathname !== '/shows/new')
    );
  }
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

function readFeaturedTemplateDismissedUntil() {
  try {
    const cookiePrefix = `${featuredTemplateDismissalCookieName}=`;
    const cookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith(cookiePrefix))
      ?.slice(cookiePrefix.length);

    return parseFeaturedTemplateDismissedUntil(cookie ? decodeURIComponent(cookie) : null);
  } catch {
    return null;
  }
}

function writeFeaturedTemplateDismissalCookie(dismissedUntil: number) {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${featuredTemplateDismissalCookieName}=${dismissedUntil}; Path=/; Max-Age=${featuredTemplateDismissalCookieMaxAge}; SameSite=Lax${secure}`;
  } catch {
    // Ignore cookie errors; the card should still stay hidden in this session.
  }
}

function SidebarBrand() {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          size="lg"
          className="group-data-[collapsible=icon]:justify-center"
        >
          <Link
            href="/dashboard"
            prefetch
            onClick={() => {
              if (isMobile) setOpenMobile(false);
            }}
          >
            <span className="brand-logo-mark flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
              <Sparkles size={14} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              ShowCrafter
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarNavItem({
  link,
  active,
  onNavigate,
  badge,
}: {
  link: AppNavLink;
  active: boolean;
  onNavigate: (href: string) => void;
  badge?: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const Icon = link.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={link.label}
        className={badge ? 'pr-12' : undefined}
      >
        <Link
          href={link.href}
          prefetch
          onClick={(event) => {
            if (isPlainLeftClick(event)) {
              onNavigate(link.href);
              if (isMobile) setOpenMobile(false);
            }
          }}
        >
          <Icon size={16} strokeWidth={2} />
          <span>{link.label}</span>
        </Link>
      </SidebarMenuButton>
      {badge ? (
        <SidebarMenuBadge
          className={cn(
            'right-2 h-5 min-w-7 rounded-full px-2 text-[11px]',
            badge === 'New'
              ? 'bg-violet-500/25 text-violet-100'
              : 'bg-sidebar-accent text-sidebar-accent-foreground',
          )}
        >
          {badge}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}

function SidebarPrimaryAction({
  active,
  onNavigate,
}: {
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip="New show"
          className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground data-active:bg-primary data-active:text-primary-foreground"
        >
          <Link
            href="/shows/new"
            prefetch
            onClick={(event) => {
              if (isPlainLeftClick(event)) {
                onNavigate('/shows/new');
                if (isMobile) setOpenMobile(false);
              }
            }}
          >
            <PlusCircle size={16} strokeWidth={2} />
            <span>New show</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function BackToAppItem({ onNavigate }: { onNavigate: (href: string) => void }) {
  return (
    <SidebarNavItem
      link={{ href: '/dashboard', label: 'Back to app', icon: ArrowLeft }}
      active={false}
      onNavigate={onNavigate}
    />
  );
}

function SidebarRecentShows({
  shows,
  onNavigate,
}: {
  shows: ShowSummaryCard[];
  onNavigate: (href: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  if (shows.length === 0) return null;

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent</SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="space-y-1">
          {shows.slice(0, 3).map((show) => {
            const href = `/shows/${show.slug}/preview`;
            return (
              <Link
                key={show.id}
                href={href}
                prefetch
                onClick={(event) => {
                  if (isPlainLeftClick(event)) {
                    onNavigate(href);
                    if (isMobile) setOpenMobile(false);
                  }
                }}
                className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring flex min-w-0 items-center gap-2.5 rounded-md px-2 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2"
              >
                <PaletteStrip palette={show.palette} className="h-5 w-1.5" />
                <span className="truncate">{show.title}</span>
              </Link>
            );
          })}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SidebarFeaturedTemplate({
  template,
  onNavigate,
  onDismiss,
  dismissed,
}: {
  template: TemplateSummaryCard | null;
  onNavigate: (href: string) => void;
  onDismiss: () => void;
  dismissed: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  if (!template || dismissed) return null;

  const href = `/library/${template.slug}`;

  return (
    <div className="relative mt-auto px-2 pt-2 pb-1 group-data-[collapsible=icon]:hidden">
      <Link
        href={href}
        prefetch
        onClick={(event) => {
          if (isPlainLeftClick(event)) {
            onNavigate(href);
            if (isMobile) setOpenMobile(false);
          }
        }}
        className="border-sidebar-border/80 bg-sidebar-accent/20 hover:bg-sidebar-accent/45 focus-visible:ring-sidebar-ring block rounded-lg border px-2.5 py-2 transition-colors focus:outline-none focus-visible:ring-2"
      >
        <span className="text-sidebar-foreground/50 block pr-7 text-[11px] leading-4 font-semibold">
          Show of the week
        </span>
        <span className="text-sidebar-accent-foreground mt-0.5 block truncate pr-7 text-[13px] leading-4 font-semibold tracking-tight">
          {template.title}
        </span>
        <span
          aria-hidden
          className="mt-2 block h-1 w-full rounded-full"
          style={getFeaturedTemplateAccentStyle(template)}
        />
      </Link>
      <button
        type="button"
        aria-label="Hide show of the week for one day"
        onClick={onDismiss}
        className="text-sidebar-foreground/45 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-sidebar-ring absolute top-3 right-4 z-10 flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2"
      >
        <X aria-hidden size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

function ProfileMenuButton({
  profile,
  onSignOut,
}: {
  profile: ProfileSummary;
  onSignOut: () => Promise<void>;
}) {
  const { isMobile } = useSidebar();
  const closeFromPointerOutsideRef = useRef(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <GeneratedAvatar name={profile.displayName} email={profile.secondaryLine} />
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{profile.displayName}</span>
                {profile.secondaryLine ? (
                  <span className="text-muted-foreground truncate text-xs">
                    {profile.secondaryLine}
                  </span>
                ) : null}
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
            onPointerDownOutside={() => {
              closeFromPointerOutsideRef.current = true;
            }}
            onCloseAutoFocus={(event) => {
              if (!closeFromPointerOutsideRef.current) return;

              event.preventDefault();
              closeFromPointerOutsideRef.current = false;
            }}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <GeneratedAvatar name={profile.displayName} email={profile.secondaryLine} />
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{profile.displayName}</span>
                  {profile.secondaryLine ? (
                    <span className="text-muted-foreground truncate text-xs">
                      {profile.secondaryLine}
                    </span>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings/profile" prefetch>
                  <CircleUser />
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/billing" prefetch>
                  <CreditCard />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/notifications" prefetch>
                  <MessageSquareDot />
                  Notifications
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void onSignOut();
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function AppSidebarFooter({
  profile,
  impersonation,
  inSettings,
  onSignOut,
}: {
  profile: ProfileSummary;
  impersonation?: ActiveImpersonation | null;
  inSettings: boolean;
  onSignOut: () => Promise<void>;
}) {
  const { isMobile, state } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;

  if (!impersonation && inSettings) return null;

  return (
    <SidebarFooter>
      {impersonation ? (
        <ImpersonationBanner impersonation={impersonation} collapsed={collapsed} />
      ) : null}
      {!inSettings ? <ProfileMenuButton profile={profile} onSignOut={onSignOut} /> : null}
    </SidebarFooter>
  );
}

function formatPathSegment(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSettingsBreadcrumbs(pathname: string): ShellBreadcrumb[] {
  const current = SETTINGS_BREADCRUMB_LABELS[pathname] ?? 'Settings';
  return [
    { label: 'Settings', href: current === 'Settings' ? undefined : '/settings/profile' },
    ...(current === 'Settings' ? [] : [{ label: current }]),
  ];
}

function getShowBreadcrumbs(segments: string[]): ShellBreadcrumb[] {
  if (segments[1] === 'new') {
    return [{ label: 'My shows', href: '/shows' }, { label: 'New show' }];
  }

  if (!segments[1]) {
    return [{ label: 'My shows' }];
  }

  const showHref = `/shows/${segments[1]}`;
  return [
    { label: 'My shows', href: '/shows' },
    {
      label: formatPathSegment(segments[1]),
      href: segments[2] ? showHref : undefined,
    },
    ...(segments[2]
      ? [
          {
            label: SHOW_SUBPAGE_LABELS[segments[2]] ?? formatPathSegment(segments[2]),
          },
        ]
      : []),
  ];
}

function getAppBreadcrumbs(pathname: string | null): ShellBreadcrumb[] {
  const normalisedPath = (pathname ?? '/dashboard').replace(/\/+$/, '') || '/dashboard';
  if (normalisedPath === '/dashboard') return [{ label: 'Dashboard' }];
  if (normalisedPath.startsWith('/settings')) return getSettingsBreadcrumbs(normalisedPath);

  const segments = normalisedPath.split('/').filter(Boolean);
  if (segments[0] === 'shows') return getShowBreadcrumbs(segments);
  if (segments[0] === 'library') {
    return [
      { label: 'Explore', href: segments[1] ? '/library' : undefined },
      ...(segments[1] ? [{ label: formatPathSegment(segments[1]) }] : []),
    ];
  }

  const staticLabel = APP_LINKS.find((link) => link.href === `/${segments[0]}`)?.label;
  return [{ label: staticLabel ?? formatPathSegment(segments[0] ?? 'Workspace') }];
}

function ShellBreadcrumbs({ breadcrumbs }: { breadcrumbs: ShellBreadcrumb[] }) {
  const crumbs = breadcrumbs.length > 0 ? breadcrumbs : [{ label: 'Dashboard' }];

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={index} className="flex min-w-0 items-center gap-1">
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                prefetch
                className="text-muted-foreground hover:text-foreground truncate transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={cn('truncate', isLast ? 'text-foreground' : 'text-muted-foreground')}
              >
                {crumb.label}
              </span>
            )}
            {!isLast ? (
              <ChevronRight size={14} className="text-muted-foreground/70 shrink-0" />
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}

function ShellTopBar({ pathname }: { pathname: string | null }) {
  const breadcrumbs = getAppBreadcrumbs(pathname);

  return (
    <header
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/85 border-border flex h-14 shrink-0 items-center gap-2 overflow-hidden border-b px-4 backdrop-blur sm:px-6',
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mx-1 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
      />
      <ShellBreadcrumbs breadcrumbs={breadcrumbs} />
    </header>
  );
}

export function AppShell({
  children,
  profile,
  impersonation,
  initialSidebarCollapsed = false,
  hasInitialSidebarCollapsedCookie = false,
  initialFeaturedTemplateDismissedUntil = null,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
  const [featuredTemplateDismissedUntil, setFeaturedTemplateDismissedUntil] = useState<
    number | null
  >(initialFeaturedTemplateDismissedUntil);
  const effectivePath = pendingHref ?? pathname;
  const inSettings = effectivePath?.startsWith('/settings') ?? false;
  const { sidebarCollapsed, sidebarTransitionReady, setSidebarCollapsedPreference } =
    useSidebarPreference({
      initialCollapsed: initialSidebarCollapsed,
      hasInitialCookie: hasInitialSidebarCollapsedCookie,
    });

  const permissions = new Set(profile?.permissions ?? []);
  const workspaceLinks = APP_LINKS.map((link) => {
    if (link.href === '/shows' && workspaceSummary?.showCount) {
      return { ...link, badge: String(workspaceSummary.showCount) };
    }
    if (link.href === '/library') {
      return { ...link, badge: 'New' };
    }
    return link;
  });
  const visibleLinks = workspaceLinks.filter(
    (link) => !link.permission || permissions.has(link.permission),
  );
  const navLinks = inSettings ? SETTINGS_LINKS : visibleLinks;

  const displayName = profile?.fullName || profile?.email || 'Account';
  const secondaryLine = profile?.fullName && profile?.email ? profile.email : '';
  const profileSummary: ProfileSummary = {
    displayName,
    secondaryLine,
  };

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    const storedDismissedUntil = readFeaturedTemplateDismissedUntil();
    setFeaturedTemplateDismissedUntil(
      storedDismissedUntil ?? initialFeaturedTemplateDismissedUntil,
    );
  }, [initialFeaturedTemplateDismissedUntil]);

  useEffect(() => {
    if (!featuredTemplateDismissedUntil) return;

    const remainingMs = Math.max(0, featuredTemplateDismissedUntil - Date.now());
    const timer = window.setTimeout(() => setFeaturedTemplateDismissedUntil(null), remainingMs);
    return () => window.clearTimeout(timer);
  }, [featuredTemplateDismissedUntil]);

  useEffect(() => {
    let active = true;

    async function loadWorkspaceSummary() {
      try {
        const response = await fetch('/api/me/summary', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;
        const nextSummary = (await response.json()) as WorkspaceSummary;
        if (active) setWorkspaceSummary(nextSummary);
      } catch {
        if (active) setWorkspaceSummary(null);
      }
    }

    void loadWorkspaceSummary();

    return () => {
      active = false;
    };
  }, [pathname]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleDismissFeaturedTemplate = () => {
    const dismissedUntil = Date.now() + featuredTemplateDismissalDurationMs;
    setFeaturedTemplateDismissedUntil(dismissedUntil);
    writeFeaturedTemplateDismissalCookie(dismissedUntil);
  };

  return (
    <SidebarProvider
      defaultOpen={!initialSidebarCollapsed}
      open={!sidebarCollapsed}
      onOpenChange={(open) => setSidebarCollapsedPreference(!open)}
      className={cn(
        'bg-sidebar text-sidebar-foreground h-svh overflow-hidden font-sans',
        !sidebarTransitionReady && '[&_*]:!transition-none',
      )}
      style={{ '--sidebar-width': 'calc(var(--spacing) * 64)' } as CSSProperties}
    >
      <ThemePreferenceSync themePreference={profile?.themePreference} />
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarBrand />
          <SidebarPrimaryAction
            active={isActivePath(effectivePath, '/shows/new')}
            onNavigate={setPendingHref}
          />
        </SidebarHeader>

        <SidebarContent className="gap-1">
          {inSettings ? (
            <>
              <SidebarGroup>
                <SidebarGroupLabel>Settings</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {navLinks.map((link) => (
                      <SidebarNavItem
                        key={link.href}
                        link={link}
                        active={isActivePath(effectivePath, link.href)}
                        onNavigate={setPendingHref}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    <BackToAppItem onNavigate={setPendingHref} />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          ) : (
            <>
              <SidebarGroup>
                <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {navLinks.map((link) => (
                      <SidebarNavItem
                        key={link.href}
                        link={link}
                        active={isActivePath(effectivePath, link.href)}
                        onNavigate={setPendingHref}
                        badge={link.badge}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarRecentShows
                shows={workspaceSummary?.recentShows ?? []}
                onNavigate={setPendingHref}
              />

              <SidebarFeaturedTemplate
                template={workspaceSummary?.featuredTemplate ?? null}
                onNavigate={setPendingHref}
                onDismiss={handleDismissFeaturedTemplate}
                dismissed={featuredTemplateDismissedUntil !== null}
              />
            </>
          )}
        </SidebarContent>

        <AppSidebarFooter
          profile={profileSummary}
          impersonation={impersonation}
          inSettings={inSettings}
          onSignOut={handleSignOut}
        />
      </Sidebar>

      <SidebarInset className="bg-background md:peer-data-[variant=inset]:border-border h-svh min-h-0 overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:max-h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:border">
        <ShellTopBar pathname={effectivePath} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-6 pb-10 sm:px-8 sm:pb-12 lg:px-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
