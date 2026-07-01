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
  useRef,
  useState,
  useTransition,
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
  Gauge,
  Home,
  Laptop,
  LogIn,
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

const SIDEBAR_FREE_SHOWS_INCLUDED = 3;
const SIDEBAR_USED_SHOW_SEGMENT_STYLE = {
  backgroundColor: 'color-mix(in srgb, var(--sidebar-foreground) 10%, var(--sidebar))',
  backgroundImage:
    'repeating-linear-gradient(90deg, color-mix(in srgb, var(--sidebar-foreground) 18%, transparent) 0, color-mix(in srgb, var(--sidebar-foreground) 18%, transparent) 4px, transparent 4px, transparent 8px)',
};
const SIDEBAR_HEADER_TRIGGER_CLASS =
  'h-8 w-8 shrink-0 cursor-pointer rounded-md bg-transparent text-sidebar-accent-foreground opacity-100 shadow-none transition-[opacity,background-color,color] duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-none active:translate-y-0 active:not-aria-[haspopup]:translate-y-0 dark:hover:bg-sidebar-accent [&_svg]:size-5 group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:z-10 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:text-sidebar-accent-foreground group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:group-hover:pointer-events-auto group-data-[collapsible=icon]:group-hover:opacity-100 group-data-[collapsible=icon]:focus-visible:pointer-events-auto group-data-[collapsible=icon]:focus-visible:opacity-100';
const SIDEBAR_NAV_BADGE_CLASS =
  'right-2 h-5 min-w-7 rounded-full border bg-transparent px-2 text-[11px] shadow-none transition-colors';
const SIDEBAR_NAV_NEW_BADGE_CLASS =
  'border-violet-300 text-violet-950 peer-hover/menu-button:border-violet-400 peer-hover/menu-button:text-violet-950 peer-data-active/menu-button:border-violet-400 peer-data-active/menu-button:text-violet-950 dark:border-violet-400/45 dark:text-violet-100 dark:peer-hover/menu-button:border-violet-300/70 dark:peer-hover/menu-button:text-violet-50 dark:peer-data-active/menu-button:border-violet-300/70 dark:peer-data-active/menu-button:text-violet-50';
const SIDEBAR_NAV_COUNT_BADGE_CLASS =
  'border-[color:var(--hl)] text-violet-950 peer-hover/menu-button:border-[color:var(--hl)] peer-hover/menu-button:text-violet-950 peer-data-active/menu-button:border-[color:var(--hl)] peer-data-active/menu-button:text-violet-950 dark:border-[color:var(--hl)] dark:text-violet-100 dark:peer-hover/menu-button:border-[color:var(--hl)] dark:peer-hover/menu-button:text-violet-50 dark:peer-data-active/menu-button:border-[color:var(--hl)] dark:peer-data-active/menu-button:text-violet-50';

const PROFILE_THEME_OPTIONS: ThemeMenuOption[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Laptop },
];

function isThemePreference(value: string | undefined): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

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
      <div className="border-border bg-background ml-auto grid h-7 w-[6.75rem] shrink-0 grid-cols-3 items-center rounded-full border p-0.5">
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
                    'focus-visible:ring-ring/50 text-muted-foreground flex h-full w-full items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2',
                    active
                      ? 'bg-muted text-foreground shadow-xs'
                      : 'group-hover/theme:text-muted-foreground',
                  )}
                >
                  <Icon size={12} strokeWidth={2.2} />
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

  const reserved = Math.max(usage?.reserved ?? 0, 0);
  const usedOrReservedFreeShows = Math.min(
    Math.max((usage?.totalSpent ?? 0) + reserved, 0),
    SIDEBAR_FREE_SHOWS_INCLUDED,
  );
  const freeShowsRemaining = Math.max(SIDEBAR_FREE_SHOWS_INCLUDED - usedOrReservedFreeShows, 0);
  const summary = `${freeShowsRemaining}/${SIDEBAR_FREE_SHOWS_INCLUDED} shows left`;

  return (
    <Link
      href="/settings/usage"
      prefetch={false}
      className="border-sidebar-border/75 hover:border-sidebar-border focus-visible:ring-sidebar-ring rounded-lg border px-2.5 py-2 transition-colors group-data-[collapsible=icon]:hidden focus:outline-none focus-visible:ring-2"
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-12 rounded-md" />
          </div>
        </div>
      ) : (
        <>
          <SidebarCreditSegments
            remaining={freeShowsRemaining}
            total={SIDEBAR_FREE_SHOWS_INCLUDED}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sidebar-foreground/60 min-w-0 truncate text-[11px]">
              {summary}
            </span>
            <span className="bg-sidebar-foreground text-sidebar inline-flex h-5 shrink-0 items-center rounded-md px-2 text-[10px] font-medium">
              Upgrade
            </span>
          </div>
        </>
      )}
    </Link>
  );
}

function SidebarCreditSegments({ remaining, total }: { remaining: number; total: number }) {
  const safeRemaining = Math.min(Math.max(remaining, 0), total);
  const used = total - safeRemaining;

  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={cn('h-1.5 flex-1 rounded-full', index < used ? '' : 'bg-[color:var(--hl)]')}
          style={index < used ? SIDEBAR_USED_SHOW_SEGMENT_STYLE : undefined}
        />
      ))}
    </div>
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

function SidebarGuestFooter() {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Sign in">
            <Link
              href="/login"
              prefetch={false}
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
              prefetch={false}
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
      className="mx-auto flex w-full max-w-6xl flex-col gap-7 pt-10 sm:pt-14 lg:pt-20"
      aria-label="Loading home"
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <Skeleton className="min-h-[14rem] rounded-2xl" />
        <Skeleton className="hidden min-h-[14rem] rounded-2xl lg:block" />
      </section>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="min-h-[14rem] rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="w-40 shrink-0 space-y-2 sm:w-48">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="w-44 shrink-0 space-y-2 sm:w-48">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-10 rounded-md" />
              </div>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PendingLibrarySkeleton() {
  const shelves = [
    'Staff picks',
    'Popular this month',
    'Hot right now',
    'Fresh drops',
    'Quick bursts',
  ];

  return (
    <div className="space-y-8" aria-label="Loading show library">
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
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
  const [aiUsage, setAiUsage] = useState<SidebarAiUsage | null>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(Boolean(profile));
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

  const handleNavigate = (href: string) => {
    const nextPath = normaliseAppPath(href);
    setPendingHref(nextPath === normaliseAppPath(pathname) ? null : href);
  };

  useEffect(() => {
    if (isGuest) return;
    let active = true;

    async function loadWorkspaceSummary() {
      try {
        const response = await fetch('/api/me/summary', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          if (active) {
            setWorkspaceSummary(null);
            setAiUsage(null);
            setAiUsageLoading(false);
          }
          return;
        }
        const nextSummary = (await response.json()) as WorkspaceSummary & {
          aiUsage?: SidebarAiUsage | null;
        };
        if (active) {
          setWorkspaceSummary(nextSummary);
          setAiUsage(nextSummary.aiUsage ?? null);
          setAiUsageLoading(false);
        }
      } catch {
        if (active) {
          setWorkspaceSummary(null);
          setAiUsage(null);
          setAiUsageLoading(false);
        }
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

        {isGuest ? (
          <SidebarGuestFooter />
        ) : (
          <AppSidebarFooter
            profile={profileSummary}
            impersonation={impersonation}
            aiUsage={aiUsage}
            aiUsageLoading={aiUsageLoading}
            inSettings={inSettings}
            onSignOut={handleSignOut}
          />
        )}
      </Sidebar>

      <SidebarInset className="bg-background md:peer-data-[variant=inset]:border-border h-svh min-h-0 overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:max-h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:border-x md:peer-data-[variant=inset]:border-t md:peer-data-[variant=inset]:shadow-none">
        <ShellTopBar pathname={effectivePath} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-6 pb-10 sm:px-8 sm:pb-12 lg:px-10">
          {pendingRouteKind ? <PendingRouteSkeleton kind={pendingRouteKind} /> : children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
