'use client';

/**
 * AdminShell - admin route chrome built on the shared shadcn sidebar primitive.
 * Admin destinations stay RBAC-gated upstream by server components and middleware.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  createContext,
  useEffect,
  useContext,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ChevronRight,
  CircleUser,
  CreditCard,
  Database,
  FileInput,
  ImageIcon,
  Laptop,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquareDot,
  MessageSquareText,
  Moon,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { updateProfileAction } from '@/app/actions/platform-admin';
import { ImpersonationBanner } from '@/app/components/app/ImpersonationBanner';
import { ThemePreferenceSync } from '@/app/components/theme/ThemePreferenceSync';
import { useSidebarPreference } from '@/app/components/app/useSidebarPreference';
import { GeneratedAvatar } from '@/app/components/ui/GeneratedAvatar';
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isPlainLeftClick, isThemePreference } from '@/app/components/shell-utils';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import type { CurrentProfile, PermissionKey, ThemePreference } from '@/lib/admin.types';
import type { ActiveImpersonation } from '@/lib/impersonation.types';

type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionKey;
};

const ADMIN_LINKS: AdminNavLink[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, permission: 'admin.view' },
  { href: '/admin/users', label: 'Users', icon: Users, permission: 'admin.manage_users' },
  { href: '/admin/roles', label: 'Roles', icon: ShieldCheck, permission: 'admin.manage_users' },
  {
    href: '/admin/suppliers',
    label: 'Suppliers',
    icon: Store,
    permission: 'admin.manage_suppliers',
  },
  {
    href: '/admin/catalogue',
    label: 'Catalogue',
    icon: Database,
    permission: 'admin.manage_catalogue',
  },
  {
    href: '/admin/effects',
    label: 'Effects',
    icon: Sparkles,
    permission: 'admin.manage_catalogue',
  },
  {
    href: '/admin/fireworks',
    label: 'Fireworks',
    icon: Rocket,
    permission: 'admin.manage_catalogue',
  },
  {
    href: '/admin/multishots',
    label: 'Multishots',
    icon: Layers,
    permission: 'admin.manage_catalogue',
  },
  {
    href: '/admin/show-presets',
    label: 'Explore shows',
    icon: Star,
    permission: 'admin.manage_catalogue',
  },
  {
    href: '/admin/cover-posters',
    label: 'Cover posters',
    icon: ImageIcon,
    permission: 'admin.manage_catalogue',
  },
  {
    href: '/admin/imports',
    label: 'Imports',
    icon: FileInput,
    permission: 'admin.manage_imports',
  },
  {
    href: '/admin/prompts',
    label: 'Prompts',
    icon: MessageSquareText,
    permission: 'admin.manage_prompts',
  },
];

const SIDEBAR_HEADER_TRIGGER_CLASS =
  'h-8 w-8 shrink-0 cursor-pointer rounded-md bg-transparent text-sidebar-accent-foreground opacity-100 shadow-none transition-[opacity,background-color,color] duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-none active:translate-y-0 active:not-aria-[haspopup]:translate-y-0 dark:hover:bg-sidebar-accent [&_svg]:size-5 group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:z-10 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:text-sidebar-accent-foreground group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:group-hover:pointer-events-auto group-data-[collapsible=icon]:group-hover:opacity-100 group-data-[collapsible=icon]:focus-visible:pointer-events-auto group-data-[collapsible=icon]:focus-visible:opacity-100';

type ProfileSummary = {
  displayName: string;
  secondaryLine: string;
};

type ThemeMenuOption = {
  value: ThemePreference;
  label: string;
  icon: LucideIcon;
};

type Breadcrumb = {
  label: string;
  href?: string;
};

const AdminBreadcrumbOverrideContext = createContext<(breadcrumb: Breadcrumb | null) => void>(
  () => {},
);

const PROFILE_THEME_OPTIONS: ThemeMenuOption[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Laptop },
];

export function useAdminBreadcrumbOverride() {
  return useContext(AdminBreadcrumbOverrideContext);
}

function isActivePath(pathname: string | null, href: string) {
  return pathname === href || (href !== '/admin' && Boolean(pathname?.startsWith(`${href}/`)));
}

function getAdminBreadcrumbs(pathname: string | null): Breadcrumb[] {
  const match = ADMIN_LINKS.find((link) => isActivePath(pathname, link.href));
  return [
    { label: 'Admin', href: '/admin' },
    { label: match?.label ?? 'Overview', href: match?.href },
  ];
}

function SidebarBrand() {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <div className="relative flex min-w-0 items-center gap-1 group-data-[collapsible=icon]:justify-center">
      <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="lg"
            tooltip="ShowCrafter Admin"
            className="h-10 transition-opacity duration-150 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:group-hover:opacity-0"
          >
            <Link
              href="/admin"
              prefetch={false}
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
            >
              <span className="brand-logo-mark flex h-7 w-7 shrink-0 items-center justify-center rounded-md group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                <Sparkles size={16} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <span className="block truncate text-sm font-semibold tracking-tight">
                  ShowCrafter
                </span>
                <span className="text-muted-foreground block truncate text-[10px] font-medium tracking-wide uppercase">
                  Admin
                </span>
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
}: {
  link: AdminNavLink;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const Icon = link.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={link.label}>
        <Link
          href={link.href}
          prefetch={false}
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
    </SidebarMenuItem>
  );
}

function BackToAppItem({ onNavigate }: { onNavigate: (href: string) => void }) {
  return (
    <SidebarNavItem
      link={{ href: '/home', label: 'Back to app', icon: ArrowLeft, permission: 'admin.view' }}
      active={false}
      onNavigate={onNavigate}
    />
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
                <span className="text-muted-foreground truncate text-xs">
                  {profile.secondaryLine}
                </span>
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
                  <span className="text-muted-foreground truncate text-xs">
                    {profile.secondaryLine}
                  </span>
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

function AdminSidebarFooter({
  profile,
  impersonation,
  onSignOut,
}: {
  profile: ProfileSummary;
  impersonation?: ActiveImpersonation | null;
  onSignOut: () => Promise<void>;
}) {
  const { isMobile, state } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;

  return (
    <SidebarFooter>
      {impersonation ? (
        <ImpersonationBanner impersonation={impersonation} collapsed={collapsed} />
      ) : null}
      <ProfileMenuButton profile={profile} onSignOut={onSignOut} />
    </SidebarFooter>
  );
}

function ShellTopBar({ breadcrumbs }: { breadcrumbs: Breadcrumb[] }) {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/85 border-border flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur sm:px-6">
      <SidebarTrigger className="shrink-0 md:hidden" aria-label="Open admin navigation" />
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm"
      >
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const content =
            crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                prefetch={false}
                className="hover:text-foreground truncate transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className={cn('truncate', isLast && 'text-foreground font-medium')}>
                {crumb.label}
              </span>
            );

          return (
            <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {content}
              {!isLast ? (
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              ) : null}
            </span>
          );
        })}
      </nav>
    </header>
  );
}

export function AdminShell({
  children,
  profile,
  impersonation,
  initialSidebarCollapsed = false,
  hasInitialSidebarCollapsedCookie = false,
}: {
  children: ReactNode;
  profile: CurrentProfile;
  impersonation?: ActiveImpersonation | null;
  initialSidebarCollapsed?: boolean;
  hasInitialSidebarCollapsedCookie?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [breadcrumbOverride, setBreadcrumbOverride] = useState<Breadcrumb | null>(null);
  const effectivePath = pendingHref ?? pathname;
  const { sidebarCollapsed, sidebarTransitionReady, setSidebarCollapsedPreference } =
    useSidebarPreference({
      initialCollapsed: initialSidebarCollapsed,
      hasInitialCookie: hasInitialSidebarCollapsedCookie,
    });
  const baseBreadcrumbs = getAdminBreadcrumbs(effectivePath);
  const breadcrumbs = breadcrumbOverride
    ? [...baseBreadcrumbs, breadcrumbOverride]
    : baseBreadcrumbs;
  const displayName = profile.fullName || profile.email || 'Admin';
  const profileSummary: ProfileSummary = {
    displayName,
    secondaryLine: profile.fullName && profile.email ? profile.email : 'Platform admin',
  };

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

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
      style={{ '--sidebar-width': 'calc(var(--spacing) * 60)' } as CSSProperties}
    >
      <ThemePreferenceSync themePreference={profile.themePreference} />
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarBrand />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {ADMIN_LINKS.filter((link) => profile.permissions.includes(link.permission)).map(
                  (link) => (
                    <SidebarNavItem
                      key={link.href}
                      link={link}
                      active={isActivePath(effectivePath, link.href)}
                      onNavigate={setPendingHref}
                    />
                  ),
                )}
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
        </SidebarContent>

        <AdminSidebarFooter
          profile={profileSummary}
          impersonation={impersonation}
          onSignOut={handleSignOut}
        />
      </Sidebar>

      <AdminBreadcrumbOverrideContext.Provider value={setBreadcrumbOverride}>
        <SidebarInset className="bg-background md:peer-data-[variant=inset]:border-border h-svh min-h-0 overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:max-h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:border">
          <ShellTopBar breadcrumbs={breadcrumbs} />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-8 lg:px-10">
            {children}
          </main>
        </SidebarInset>
      </AdminBreadcrumbOverrideContext.Provider>
    </SidebarProvider>
  );
}
