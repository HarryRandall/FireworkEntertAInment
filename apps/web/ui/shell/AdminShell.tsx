'use client';

import { WorkspaceContent, WorkspaceShell, WorkspaceHeader } from './WorkspaceShell';

import { WorkspaceAccountMenu } from './WorkspaceAccountMenu';

import { SidebarBrand } from '@/ui/shell/SidebarBrand';

/**
 * AdminShell - admin route chrome built on the shared shadcn sidebar primitive.
 * Admin destinations stay RBAC-gated upstream by server components and middleware.
 */
import { isPlainLeftClick } from '@/ui/shell/shell-utils';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from '@/ui/primitives/sidebar';
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
import { usePathname, useSearchParams } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

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

function ShellTopBar({ breadcrumbs }: { breadcrumbs: Breadcrumb[] }) {
  return (
    <WorkspaceHeader navigationLabel="Open admin navigation">
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
    </WorkspaceHeader>
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
  const baseBreadcrumbs = getAdminBreadcrumbs(effectivePath).map((breadcrumb) =>
    breadcrumb.href === '/admin/effects' && effectsView
      ? { ...breadcrumb, href: adminEffectsViewHref(effectsView) }
      : breadcrumb,
  );
  const breadcrumbs = breadcrumbOverride
    ? [...baseBreadcrumbs, breadcrumbOverride]
    : baseBreadcrumbs;

  useEffect(() => {
    setPendingHref(null);
  }, [currentSearch, pathname]);

  return (
    <WorkspaceShell
      initialSidebarCollapsed={initialSidebarCollapsed}
      hasInitialSidebarCollapsedCookie={hasInitialSidebarCollapsedCookie}
      themePreference={profile.themePreference}
    >
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

        <WorkspaceAccountMenu profile={profile} impersonation={impersonation} />
      </Sidebar>

      <AdminBreadcrumbOverrideContext.Provider value={setBreadcrumbOverride}>
        <WorkspaceContent header={<ShellTopBar breadcrumbs={breadcrumbs} />}>
          {children}
        </WorkspaceContent>
      </AdminBreadcrumbOverrideContext.Provider>
    </WorkspaceShell>
  );
}
