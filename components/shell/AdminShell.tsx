'use client';

import { ProfileMenu, type ProfileSummary } from '@/components/shell/ProfileMenu';
import { SidebarBrand } from '@/components/shell/SidebarBrand';

/**
 * AdminShell - admin route chrome built on the shared shadcn sidebar primitive.
 * Admin destinations stay RBAC-gated upstream by server components and middleware.
 */
import { SkipLink } from '@/components/design-system/SkipLink';
import { toast } from '@/components/design-system/toast';
import { ImpersonationBanner } from '@/components/shell/ImpersonationBanner';
import { isPlainLeftClick } from '@/components/shell/shell-utils';
import { signOutCurrentSession } from '@/components/shell/sign-out.client';
import { useSidebarPreference } from '@/components/shell/useSidebarPreference';
import { ThemePreferenceSync } from '@/components/theme/ThemePreferenceSync';
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  ADMIN_EFFECTS_VIEWS,
  adminEffectsViewHref,
  adminEffectsViewLabel,
  isAdminEffectsView,
  parseAdminEffectsView,
  type AdminEffectsView,
} from '@/lib/admin-effects-navigation';
import type { CurrentProfile, PermissionKey } from '@/lib/admin.types';
import type { ActiveImpersonation } from '@/lib/impersonation.types';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ChevronRight,
  Database,
  FileInput,
  Layers,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

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
    href: '/admin/assortments',
    label: 'Assortments',
    icon: Package,
    permission: 'admin.manage_assortments',
  },
  {
    href: '/admin/show-presets',
    label: 'Explore shows',
    icon: Star,
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

type Breadcrumb = {
  label: string;
  href?: string;
};

const AdminBreadcrumbOverrideContext = createContext<(breadcrumb: Breadcrumb | null) => void>(
  () => {},
);

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

function AdminEffectsNavItem({
  active,
  activeView,
  onNavigate,
}: {
  active: boolean;
  activeView: AdminEffectsView | null;
  onNavigate: (href: string) => void;
}) {
  const { isMobile, setOpen, setOpenMobile, state } = useSidebar();
  const [expanded, setExpanded] = useState(active);

  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);

  const submenuVisible = expanded && (isMobile || state === 'expanded');

  const toggleExpanded = () => {
    if (!isMobile && state === 'collapsed') {
      setOpen(true);
      setExpanded(true);
      return;
    }
    setExpanded((current) => !current);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={active}
        tooltip="Effects"
        aria-expanded={submenuVisible}
        aria-controls="admin-effects-navigation"
        onClick={toggleExpanded}
      >
        <Sparkles size={16} strokeWidth={2} />
        <span>Effects</span>
        <ChevronRight
          aria-hidden
          className={cn(
            'ml-auto transition-transform duration-200 motion-reduce:transition-none',
            expanded && 'rotate-90',
          )}
        />
      </SidebarMenuButton>

      {submenuVisible ? (
        <SidebarMenuSub id="admin-effects-navigation">
          {ADMIN_EFFECTS_VIEWS.map((view) => {
            const href = adminEffectsViewHref(view);
            const selected = activeView === view;
            return (
              <SidebarMenuSubItem key={view}>
                <SidebarMenuSubButton asChild isActive={selected} className="h-11 md:h-7">
                  <Link
                    href={href}
                    prefetch={false}
                    aria-current={selected ? 'page' : undefined}
                    onClick={(event) => {
                      if (isPlainLeftClick(event)) {
                        onNavigate(href);
                        if (isMobile) setOpenMobile(false);
                      }
                    }}
                  >
                    <span>{adminEffectsViewLabel(view)}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      ) : null}
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
      <ProfileMenu profile={profile} onSignOut={onSignOut} />
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
  const searchParams = useSearchParams();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [breadcrumbOverride, setBreadcrumbOverride] = useState<Breadcrumb | null>(null);
  const currentSearch = searchParams.toString();
  const pendingPath = pendingHref?.split(/[?#]/, 1)[0] ?? null;
  const effectivePath = pendingPath ?? pathname;
  const pendingSearchParams = pendingHref?.includes('?')
    ? new URLSearchParams(pendingHref.slice(pendingHref.indexOf('?') + 1))
    : null;
  const requestedEffectsView = pendingSearchParams?.get('view') ?? searchParams.get('view');
  const requestedLegacyEffectsTab = pendingSearchParams?.get('tab') ?? searchParams.get('tab');
  const effectsView = effectivePath?.startsWith('/admin/effects/defaults/')
    ? isAdminEffectsView(requestedEffectsView)
      ? requestedEffectsView
      : null
    : parseAdminEffectsView(requestedEffectsView, requestedLegacyEffectsTab);
  const { sidebarCollapsed, sidebarTransitionReady, setSidebarCollapsedPreference } =
    useSidebarPreference({
      initialCollapsed: initialSidebarCollapsed,
      hasInitialCookie: hasInitialSidebarCollapsedCookie,
    });
  const baseBreadcrumbs = getAdminBreadcrumbs(effectivePath).map((breadcrumb) =>
    breadcrumb.href === '/admin/effects' && effectsView
      ? { ...breadcrumb, href: adminEffectsViewHref(effectsView) }
      : breadcrumb,
  );
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
  }, [currentSearch, pathname]);

  const handleSignOut = async () => {
    const result = await signOutCurrentSession();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.replace('/login');
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
      <SkipLink />
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarBrand href="/admin" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {ADMIN_LINKS.filter((link) => profile.permissions.includes(link.permission)).map(
                  (link) =>
                    link.href === '/admin/effects' ? (
                      <AdminEffectsNavItem
                        key={link.href}
                        active={isActivePath(effectivePath, link.href)}
                        activeView={isActivePath(effectivePath, link.href) ? effectsView : null}
                        onNavigate={setPendingHref}
                      />
                    ) : (
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
          <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 focus:outline-none sm:px-8 lg:px-10"
          >
            {children}
          </main>
        </SidebarInset>
      </AdminBreadcrumbOverrideContext.Provider>
    </SidebarProvider>
  );
}
