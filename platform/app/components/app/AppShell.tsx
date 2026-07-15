'use client';

/**
 * AppShell - authenticated workspace chrome built on the shadcn sidebar
 * primitive, with ShowCrafter route permissions and persisted collapse state.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
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
  Gauge,
  Home,
  Laptop,
  LogOut,
  MessageSquareDot,
  Moon,
  Music4,
  PlusCircle,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { updateProfileAction } from '@/app/actions/platform-admin';
import { ThemePreferenceSync } from '@/app/components/theme/ThemePreferenceSync';
import { ImpersonationBanner } from '@/app/components/app/ImpersonationBanner';
import { useSidebarPreference } from '@/app/components/app/useSidebarPreference';
import { GeneratedAvatar } from '@/app/components/ui/GeneratedAvatar';
import { Skeleton } from '@/app/components/ui/Feedback';
import { toast } from '@/app/components/ui/toast';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PaletteStrip } from '@/app/components/app/ShowSummaryCards';
import { SkipLink } from '@/app/components/ui/SkipLink';
import { isPlainLeftClick, isThemePreference } from '@/app/components/shell-utils';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import type { CurrentProfile, PermissionKey, ThemePreference } from '@/lib/admin.types';
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
  { href: '/safety', label: 'Safety', icon: TriangleAlert },
  { href: '/admin', label: 'Admin', icon: Shield, permission: 'admin.view' },
];

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
  initialSidebarCollapsed?: boolean;
  hasInitialSidebarCollapsedCookie?: boolean;
};

type ProfileSummary = {
  displayName: string;
  secondaryLine: string;
};

type ThemeMenuOption = {
  value: ThemePreference;
  label: string;
  icon: LucideIcon;
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

const SIDEBAR_HEADER_TRIGGER_CLASS =
  'h-8 w-8 shrink-0 cursor-pointer rounded-md bg-transparent text-sidebar-accent-foreground opacity-100 shadow-none transition-[opacity,background-color,color] duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-none active:translate-y-0 active:not-aria-[haspopup]:translate-y-0 dark:hover:bg-sidebar-accent [&_svg]:size-5 group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:z-10 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:text-sidebar-accent-foreground group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:group-hover:pointer-events-auto group-data-[collapsible=icon]:group-hover:opacity-100 group-data-[collapsible=icon]:focus-visible:pointer-events-auto group-data-[collapsible=icon]:focus-visible:opacity-100';
const SIDEBAR_NAV_BADGE_CLASS =
  'right-2 h-5 min-w-7 rounded-full border bg-transparent px-2 text-[11px] shadow-none transition-colors';
const SIDEBAR_NAV_NEW_BADGE_CLASS =
  'border-violet-300 text-violet-950 peer-hover/menu-button:border-violet-400 peer-hover/menu-button:text-violet-950 peer-data-active/menu-button:border-violet-400 peer-data-active/menu-button:text-violet-950 dark:border-violet-400/45 dark:text-violet-100 dark:peer-hover/menu-button:border-violet-300/70 dark:peer-hover/menu-button:text-violet-50 dark:peer-data-active/menu-button:border-violet-300/70 dark:peer-data-active/menu-button:text-violet-50';
const SIDEBAR_NAV_COUNT_BADGE_CLASS =
  'border-hl text-hl-ink peer-hover/menu-button:border-hl peer-hover/menu-button:text-hl-ink peer-data-active/menu-button:border-hl peer-data-active/menu-button:text-hl-ink';

const PROFILE_THEME_OPTIONS: ThemeMenuOption[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Laptop },
];

type CachedWorkspaceSummary = WorkspaceSummary & {
  aiUsage?: SidebarAiUsage | null;
  cachedAt?: number;
};

const WORKSPACE_SUMMARY_CACHE_KEY_PREFIX = 'sc:workspace-summary:v3';
const WORKSPACE_SUMMARY_CACHE_TTL_MS = 60_000;

// Safe pre-paint effect: layout effect on the client, plain effect during SSR
// so React doesn't warn about useLayoutEffect on the server.
const useHydrationLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function workspaceSummaryCacheKey(profileId: string): string {
  return `${WORKSPACE_SUMMARY_CACHE_KEY_PREFIX}:${profileId}`;
}

function readCachedWorkspaceSummary(profileId: string | null): CachedWorkspaceSummary | null {
  if (typeof window === 'undefined' || !profileId) return null;
  try {
    const raw = window.sessionStorage.getItem(workspaceSummaryCacheKey(profileId));
    return raw ? (JSON.parse(raw) as CachedWorkspaceSummary) : null;
  } catch {
    return null;
  }
}

function isWorkspaceSummaryFresh(summary: CachedWorkspaceSummary | null): boolean {
  return Boolean(
    summary?.cachedAt && Date.now() - summary.cachedAt < WORKSPACE_SUMMARY_CACHE_TTL_MS,
  );
}

function writeCachedWorkspaceSummary(
  profileId: string | null,
  summary: CachedWorkspaceSummary | null,
) {
  if (typeof window === 'undefined' || !profileId) return;
  try {
    const cacheKey = workspaceSummaryCacheKey(profileId);
    if (summary) {
      window.sessionStorage.setItem(cacheKey, JSON.stringify(summary));
    } else {
      window.sessionStorage.removeItem(cacheKey);
    }
  } catch {
    // Ignore storage failures; the sidebar just falls back to fetching.
  }
}

function clearCachedAiUsage(profileId: string | null) {
  const cached = readCachedWorkspaceSummary(profileId);
  if (!cached) return;
  writeCachedWorkspaceSummary(profileId, { ...cached, aiUsage: null, cachedAt: 0 });
}

function isActivePath(pathname: string | null, href: string) {
  if (href === '/shows') {
    return (
      pathname === '/shows' || Boolean(pathname?.startsWith('/shows/') && pathname !== '/shows/new')
    );
  }
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

function SidebarBrand({ onNavigate }: { onNavigate: (href: string) => void }) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <div className="relative flex min-w-0 items-center gap-1 group-data-[collapsible=icon]:justify-center">
      <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="lg"
            tooltip="ShowCrafter"
            className="h-10 transition-opacity duration-150 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:group-hover:opacity-0"
          >
            <Link
              href="/home"
              prefetch={false}
              onClick={(event) => {
                if (isPlainLeftClick(event)) onNavigate('/home');
                if (isMobile) setOpenMobile(false);
              }}
            >
              <span className="brand-logo-mark flex h-7 w-7 shrink-0 items-center justify-center rounded-md group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                <Sparkles size={16} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                ShowCrafter
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarTrigger className={SIDEBAR_HEADER_TRIGGER_CLASS} />
    </div>
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
            SIDEBAR_NAV_BADGE_CLASS,
            badge === 'New' ? SIDEBAR_NAV_NEW_BADGE_CLASS : SIDEBAR_NAV_COUNT_BADGE_CLASS,
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
                prefetch={false}
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
              <Settings className="ml-auto size-4" />
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
                <Link href="/settings/profile" prefetch={false}>
                  <CircleUser />
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/billing" prefetch={false}>
                  <CreditCard />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/notifications" prefetch={false}>
                  <MessageSquareDot />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <ProfileThemeMenu />
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

function ProfileThemeMenu() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  const selectedTheme = mounted && isThemePreference(theme) ? theme : undefined;

  function chooseTheme(value: ThemePreference) {
    if (value === selectedTheme) return;

    setTheme(value);
    startTransition(async () => {
      const result = await updateProfileAction({ themePreference: value });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div
      className="group/theme focus-within:text-accent-foreground hover:text-accent-foreground relative flex h-8 items-center gap-2 rounded-sm px-2 text-sm outline-hidden transition-colors select-none focus-within:bg-[color:var(--accent)] hover:bg-[color:var(--accent)]"
      role="radiogroup"
      aria-label="Interface theme"
    >
      <Sun className="size-4 shrink-0 opacity-90" />
      <span className="min-w-0 flex-1 truncate">Theme</span>
      <div className="bg-muted ml-auto flex shrink-0 items-center gap-0.5 rounded-full p-0.5">
        {PROFILE_THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = selectedTheme === option.value;

          return (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${option.label} theme`}
                  onClick={() => chooseTheme(option.value)}
                  className={cn(
                    'focus-visible:ring-ring/50 flex h-6 w-6 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2',
                    active
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon size={13} strokeWidth={2.2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" collisionPadding={12}>
                {option.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function SidebarAiUsageMeter({
  usage,
  loading,
}: {
  usage: SidebarAiUsage | null | undefined;
  loading?: boolean;
}) {
  if (!usage && !loading) return null;

  const balance = Math.max(usage?.balance ?? 0, 0);
  const available = Math.max(usage?.available ?? 0, 0);
  const granted = Math.max(usage?.totalGranted ?? 0, usage?.includedCredits ?? 0, balance, 1);
  const balancePercentage = Math.min((balance / granted) * 100, 100);
  const summary = `${available.toLocaleString('en-AU')} credits available`;

  return (
    <Link
      href="/settings/usage"
      prefetch={false}
      aria-label="View AI credit usage"
      className="border-sidebar-border/75 hover:border-sidebar-border focus-visible:ring-sidebar-ring rounded-lg border px-2.5 py-2 transition-colors group-data-[collapsible=icon]:hidden focus:outline-none focus-visible:ring-2"
    >
      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          <div className="bg-sidebar-foreground/20 h-1.5 w-full animate-pulse rounded-full motion-reduce:animate-none" />
          <div className="flex items-center justify-between gap-2">
            <div className="bg-sidebar-foreground/20 h-3 w-24 animate-pulse rounded-md motion-reduce:animate-none" />
            <div className="bg-sidebar-foreground/20 h-5 w-12 animate-pulse rounded-md motion-reduce:animate-none" />
          </div>
        </div>
      ) : (
        <>
          <div className="bg-sidebar-foreground/20 h-1.5 overflow-hidden rounded-full" aria-hidden>
            <span
              className="block h-full rounded-full bg-[color:var(--hl)]"
              style={{ width: `${balancePercentage}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sidebar-foreground/60 min-w-0 truncate text-[11px]">
              {summary}
            </span>
            <span className="border-sidebar-border text-sidebar-foreground/70 inline-flex h-5 shrink-0 items-center rounded-md border px-2 text-[10px] font-medium">
              Usage
            </span>
          </div>
        </>
      )}
    </Link>
  );
}

function AppSidebarFooter({
  profile,
  impersonation,
  aiUsage,
  aiUsageLoading,
  inSettings,
  onSignOut,
}: {
  profile: ProfileSummary;
  impersonation?: ActiveImpersonation | null;
  aiUsage?: SidebarAiUsage | null;
  aiUsageLoading?: boolean;
  inSettings: boolean;
  onSignOut: () => Promise<void>;
}) {
  const { isMobile, state } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;

  return (
    <SidebarFooter>
      {impersonation ? (
        <ImpersonationBanner impersonation={impersonation} collapsed={collapsed} />
      ) : null}
      {!inSettings ? <SidebarAiUsageMeter usage={aiUsage} loading={aiUsageLoading} /> : null}
      <ProfileMenuButton profile={profile} onSignOut={onSignOut} />
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
      label: staticLink?.label ?? (segments[0] ? formatPathSegment(segments[0]) : 'Home'),
      icon: staticLink?.icon,
    },
  ];
}

function normaliseAppPath(pathname: string | null | undefined) {
  const pathOnly = (pathname ?? '/home').split(/[?#]/)[0];
  return pathOnly.replace(/\/+$/, '') || '/home';
}

function isHomePath(pathname: string | null) {
  return normaliseAppPath(pathname) === '/home';
}

type PendingRouteKind = 'home' | 'library';

function getPendingRouteKind(pathname: string | null | undefined): PendingRouteKind | null {
  const path = normaliseAppPath(pathname);
  if (path === '/home') return 'home';
  if (path === '/library') return 'library';
  return null;
}

function PendingHomeSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1400px] flex-col gap-7 pt-10 sm:pt-14 lg:pt-20"
      aria-label="Loading home"
      aria-busy="true"
    >
      <section className="mx-auto w-full max-w-3xl py-10">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)] sm:text-3xl">
          Create any firework show you can imagine
        </h1>
        <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)]/55 shadow-xs">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-3">
            <Skeleton className="h-9 w-36 rounded-full" />
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-label="Loading featured shows">
        <h2 className="text-on-surface text-lg font-semibold tracking-tight">Watch real shows</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="min-h-56 rounded-2xl" />
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-label="Loading Explore shows">
        <h2 className="text-on-surface text-lg font-semibold tracking-tight">Explore</h2>
        <div className="flex gap-4 overflow-hidden pb-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="w-44 shrink-0 sm:w-48" aria-hidden="true">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <Skeleton className="mt-2.5 h-4 w-4/5" />
              <Skeleton className="mt-2 h-3 w-3/5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PendingLibrarySkeleton() {
  const shelves = [
    'Staff picks',
    'Most liked',
    'More to explore',
    'Recently updated',
    'Quick bursts',
  ];

  return (
    <div
      className="mx-auto w-full max-w-[1600px] space-y-4"
      aria-label="Loading show library"
      aria-busy="true"
    >
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Explore shows</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Preview published show templates and choose one as a starting point for your own plan.
        </p>
      </header>

      <div className="space-y-8">
        {shelves.map((title) => (
          <section key={title}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-on-surface text-lg font-semibold tracking-tight">{title}</h2>
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>

            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="w-44 shrink-0 sm:w-48">
                  <Skeleton className="aspect-[4/5] w-full rounded-xl" />
                  <div className="mt-2.5 flex items-center gap-2">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-10 rounded-md" />
                  </div>
                  <Skeleton className="mt-2 h-3 w-24" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PendingRouteSkeleton({ kind }: { kind: PendingRouteKind }) {
  if (kind === 'home') return <PendingHomeSkeleton />;
  return <PendingLibrarySkeleton />;
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
                prefetch={false}
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
  const home = isHomePath(pathname);
  const breadcrumbs = getAppBreadcrumbs(pathname);

  return (
    <header
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/85 border-border flex h-14 shrink-0 items-center gap-2 overflow-hidden border-b px-4 backdrop-blur sm:px-6',
        home && 'md:hidden',
      )}
    >
      <SidebarTrigger className="shrink-0 md:hidden" aria-label="Open navigation" />
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
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // Initial state must match the server render (no cached summary) to avoid a
  // hydration mismatch; the cached copy is applied pre-paint just below.
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
  const [aiUsage, setAiUsage] = useState<SidebarAiUsage | null>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(true);
  const profileId = profile?.id ?? null;

  // Scope cached account data to the authenticated profile and clear the
  // previous profile before paint if the shell identity changes in-place.
  useHydrationLayoutEffect(() => {
    setWorkspaceSummary(null);
    setAiUsage(null);
    setAiUsageLoading(true);
    const cached = readCachedWorkspaceSummary(profileId);
    if (!cached) return;
    setWorkspaceSummary(cached);
    setAiUsage(cached.aiUsage ?? null);
    setAiUsageLoading(false);
  }, [profileId]);
  const currentPath = normaliseAppPath(pathname);
  const pendingPath = pendingHref ? normaliseAppPath(pendingHref) : null;
  const pendingRouteKind =
    pendingPath && pendingPath !== currentPath ? getPendingRouteKind(pendingPath) : null;
  const effectivePath = pendingRouteKind ? pendingPath : pathname;
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
    return link;
  });
  const visibleLinks = workspaceLinks.filter((link) => {
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

  const handleNavigate = (href: string) => {
    const nextPath = normaliseAppPath(href);
    setPendingHref(nextPath === normaliseAppPath(pathname) ? null : href);
  };

  useEffect(() => {
    let active = true;

    async function loadWorkspaceSummary() {
      if (!profileId) {
        setAiUsageLoading(false);
        return;
      }
      const cached = readCachedWorkspaceSummary(profileId);
      if (isWorkspaceSummaryFresh(cached)) {
        setWorkspaceSummary(cached);
        setAiUsage(cached?.aiUsage ?? null);
        setAiUsageLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/me/summary', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          clearCachedAiUsage(profileId);
          if (active) {
            setAiUsage(null);
            setAiUsageLoading(false);
          }
          return;
        }
        const payload = (await response.json()) as CachedWorkspaceSummary;
        const nextSummary: CachedWorkspaceSummary = { ...payload, cachedAt: Date.now() };
        writeCachedWorkspaceSummary(profileId, nextSummary);
        if (active) {
          setWorkspaceSummary(nextSummary);
          setAiUsage(nextSummary.aiUsage ?? null);
          setAiUsageLoading(false);
        }
      } catch {
        clearCachedAiUsage(profileId);
        if (active) {
          setAiUsage(null);
          setAiUsageLoading(false);
        }
      }
    }

    void loadWorkspaceSummary();

    return () => {
      active = false;
    };
  }, [pathname, profileId]);

  const handleSignOut = async () => {
    writeCachedWorkspaceSummary(profileId, null);
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
      <SkipLink />
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarBrand onNavigate={handleNavigate} />
          {!inSettings ? (
            <SidebarPrimaryAction
              active={isActivePath(effectivePath, '/shows/new')}
              onNavigate={handleNavigate}
            />
          ) : null}
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
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    <BackToAppItem onNavigate={handleNavigate} />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          ) : (
            <>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {navLinks.map((link) => (
                      <SidebarNavItem
                        key={link.href}
                        link={link}
                        active={isActivePath(effectivePath, link.href)}
                        onNavigate={handleNavigate}
                        badge={link.badge}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarRecentShows
                shows={workspaceSummary?.recentShows ?? []}
                onNavigate={handleNavigate}
              />
            </>
          )}
        </SidebarContent>

        <AppSidebarFooter
          profile={profileSummary}
          impersonation={impersonation}
          aiUsage={aiUsage}
          aiUsageLoading={aiUsageLoading}
          inSettings={inSettings}
          onSignOut={handleSignOut}
        />
      </Sidebar>

      <SidebarInset className="bg-background md:peer-data-[variant=inset]:border-border h-svh min-h-0 overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:max-h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:shadow-none">
        <ShellTopBar pathname={effectivePath} />
        <main
          // Positioned + tagged so full-pane overlays (the post-generation
          // handover splash) can portal in and cover the whole content area,
          // including any route chrome, while the app shell stays visible.
          data-app-content
          id="main-content"
          tabIndex={-1}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-6 pb-10 focus:outline-none sm:px-8 sm:pb-12 lg:px-10"
        >
          {pendingRouteKind ? <PendingRouteSkeleton kind={pendingRouteKind} /> : children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
