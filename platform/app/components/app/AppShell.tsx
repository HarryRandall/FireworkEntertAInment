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
  Home,
  LogIn,
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
import type { CurrentProfile, PermissionKey } from '@/lib/admin.types';
import type { ActiveImpersonation } from '@/lib/impersonation.types';
import type { ShowSummaryCard, WorkspaceSummary } from '@/lib/show-summary';

type AppNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  badge?: string;
};

const APP_LINKS: AppNavLink[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/shows', label: 'My shows', icon: Music4 },
  { href: '/library', label: 'Explore', icon: Star },
  { href: '/catalogue', label: 'Catalogue', icon: Box },
  { href: '/exports', label: 'Exports', icon: Download },
  { href: '/safety', label: 'Safety', icon: TriangleAlert, permission: 'admin.view' },
  { href: '/admin', label: 'Admin', icon: Shield, permission: 'admin.view' },
];

// Browse-only nav shown to unauthenticated guests; creation/private routes
// are gated by middleware and intentionally absent here.
const GUEST_NAV_HREFS = new Set(['/home', '/library', '/catalogue']);

const SETTINGS_LINKS: AppNavLink[] = [
  { href: '/settings/profile', label: 'Personal details', icon: UserRound },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings/usage', label: 'Usage', icon: Gauge },
  { href: '/settings/security', label: 'Security', icon: ShieldCheck },
];

const SETTINGS_BREADCRUMB_LABELS: Record<string, string> = {
  '/settings': 'Settings',
  '/settings/profile': 'Profile',
  '/settings/usage': 'Usage',
  '/settings/notifications': 'Notifications',
  '/settings/billing': 'Billing',
  '/settings/security': 'Security',
};

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
  icon?: LucideIcon;
};

type AppShellProps = {
  children: ReactNode;
  containerWidth?: 'default' | 'wide' | 'fluid';
  profile?: CurrentProfile | null;
  impersonation?: ActiveImpersonation | null;
  aiUsage?: SidebarAiUsage | null;
  initialSidebarCollapsed?: boolean;
  hasInitialSidebarCollapsedCookie?: boolean;
};

type ProfileSummary = {
  displayName: string;
  secondaryLine: string;
};

type SidebarAiUsage = {
  balance: number;
  available: number;
  reserved: number;
  includedCredits: number;
  hourlyLimit: number;
  weeklyLimit: number;
  hourlyUsed: number;
  weeklyUsed: number;
  hourlyRemaining: number;
  weeklyRemaining: number;
  totalGranted: number;
  totalSpent: number;
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
            href="/home"
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
      link={{ href: '/home', label: 'Back to app', icon: ArrowLeft }}
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
              variant="destructive"
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

function sidebarUsagePercent(used: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(100, Math.max(0, (used / limit) * 100));
}

function SidebarAiUsageMeter({ usage }: { usage: SidebarAiUsage | null | undefined }) {
  if (!usage) return null;

  const hourlyUsed = usage.hourlyUsed + usage.reserved;
  const weeklyUsed = usage.weeklyUsed + usage.reserved;

  return (
    <Link
      href="/settings/usage"
      prefetch
      className="border-sidebar-border/75 hover:border-sidebar-border focus-visible:ring-sidebar-ring rounded-lg border px-2.5 py-2 transition-colors group-data-[collapsible=icon]:hidden focus:outline-none focus-visible:ring-2"
    >
      <div className="mb-2 flex items-center">
        <span className="text-sidebar-foreground/70 text-[11px] font-semibold tracking-wide uppercase">
          AI usage
        </span>
      </div>
      <div className="space-y-1.5">
        <SidebarLimitProgress label="Hourly" used={hourlyUsed} limit={usage.hourlyLimit} />
        <SidebarLimitProgress label="Weekly" used={weeklyUsed} limit={usage.weeklyLimit} />
      </div>
    </Link>
  );
}

function SidebarLimitProgress({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sidebar-foreground/55 text-[11px]">{label}</span>
        <span className="text-sidebar-foreground/55 font-mono text-[11px] tabular-nums">
          {used}/{limit}
        </span>
      </div>
      <div aria-hidden className="bg-sidebar-border/60 h-1 overflow-hidden rounded-full">
        <div
          className="bg-sidebar-primary h-full rounded-full"
          style={{ width: `${sidebarUsagePercent(used, limit)}%` }}
        />
      </div>
    </div>
  );
}

function AppSidebarFooter({
  profile,
  impersonation,
  aiUsage,
  inSettings,
  onSignOut,
}: {
  profile: ProfileSummary;
  impersonation?: ActiveImpersonation | null;
  aiUsage?: SidebarAiUsage | null;
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
      {!inSettings ? <SidebarAiUsageMeter usage={aiUsage} /> : null}
      {!inSettings ? <ProfileMenuButton profile={profile} onSignOut={onSignOut} /> : null}
    </SidebarFooter>
  );
}

function SidebarGuestFooter() {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Sign in">
            <Link
              href="/login"
              prefetch
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
            >
              <LogIn size={16} strokeWidth={2} />
              <span>Sign in</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            tooltip="Create account"
            className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground data-active:bg-primary data-active:text-primary-foreground"
          >
            <Link
              href="/signup"
              prefetch
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
            >
              <PlusCircle size={16} strokeWidth={2} />
              <span>Create account</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
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
    {
      label: 'Settings',
      href: current === 'Settings' ? undefined : '/settings/profile',
      icon: UserRound,
    },
    ...(current === 'Settings' ? [] : [{ label: current }]),
  ];
}

function getShowBreadcrumbs(segments: string[]): ShellBreadcrumb[] {
  if (segments[1] === 'new') {
    return [{ label: 'My shows', href: '/shows', icon: Music4 }, { label: 'New show' }];
  }

  if (!segments[1]) {
    return [{ label: 'My shows', icon: Music4 }];
  }

  const showHref = `/shows/${segments[1]}`;
  return [
    { label: 'My shows', href: '/shows', icon: Music4 },
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
  const normalisedPath = (pathname ?? '/home').replace(/\/+$/, '') || '/home';
  if (normalisedPath === '/home') return [{ label: 'Home', icon: Home }];
  if (normalisedPath.startsWith('/settings')) return getSettingsBreadcrumbs(normalisedPath);

  const segments = normalisedPath.split('/').filter(Boolean);
  if (segments[0] === 'shows') return getShowBreadcrumbs(segments);
  if (segments[0] === 'library') {
    return [
      { label: 'Explore', href: segments[1] ? '/library' : undefined, icon: Star },
      ...(segments[1] ? [{ label: formatPathSegment(segments[1]) }] : []),
    ];
  }

  const staticLink = APP_LINKS.find((link) => link.href === `/${segments[0]}`);
  return [
    {
      label: staticLink?.label ?? formatPathSegment(segments[0] ?? 'Workspace'),
      icon: staticLink?.icon,
    },
  ];
}

function isHomePath(pathname: string | null) {
  return ((pathname ?? '/home').replace(/\/+$/, '') || '/home') === '/home';
}

function ShellBreadcrumbs({ breadcrumbs }: { breadcrumbs: ShellBreadcrumb[] }) {
  const crumbs = breadcrumbs.length > 0 ? breadcrumbs : [{ label: 'Home' }];

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const Icon = crumb.icon;
        return (
          <span key={index} className="flex min-w-0 items-center gap-1">
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                prefetch
                className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-1.5 transition-colors"
              >
                {Icon ? <Icon aria-hidden size={15} strokeWidth={2} className="shrink-0" /> : null}
                <span className="truncate">{crumb.label}</span>
              </Link>
            ) : (
              <span
                className={cn(
                  'inline-flex min-w-0 items-center gap-1.5',
                  isLast ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {Icon ? <Icon aria-hidden size={15} strokeWidth={2} className="shrink-0" /> : null}
                <span className="truncate">{crumb.label}</span>
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
  if (isHomePath(pathname)) {
    return null;
  }

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
  aiUsage,
  initialSidebarCollapsed = false,
  hasInitialSidebarCollapsedCookie = false,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
  const effectivePath = pendingHref ?? pathname;
  const inSettings = effectivePath?.startsWith('/settings') ?? false;
  const { sidebarCollapsed, sidebarTransitionReady, setSidebarCollapsedPreference } =
    useSidebarPreference({
      initialCollapsed: initialSidebarCollapsed,
      hasInitialCookie: hasInitialSidebarCollapsedCookie,
    });

  const permissions = new Set(profile?.permissions ?? []);
  const isGuest = !profile;
  const workspaceLinks = APP_LINKS.map((link) => {
    if (link.href === '/shows' && workspaceSummary?.showCount) {
      return { ...link, badge: String(workspaceSummary.showCount) };
    }
    if (link.href === '/library') {
      return { ...link, badge: 'New' };
    }
    return link;
  });
  const visibleLinks = workspaceLinks.filter((link) => {
    if (isGuest && !GUEST_NAV_HREFS.has(link.href)) return false;
    return !link.permission || permissions.has(link.permission);
  });
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
    if (isGuest) return;
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
  }, [pathname, isGuest]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
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
            </>
          )}
        </SidebarContent>

        {isGuest ? (
          <SidebarGuestFooter />
        ) : (
          <AppSidebarFooter
            profile={profileSummary}
            impersonation={impersonation}
            aiUsage={aiUsage}
            inSettings={inSettings}
            onSignOut={handleSignOut}
          />
        )}
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
