'use client';

import { WorkspaceContent, WorkspaceShell, WorkspaceHeader } from './WorkspaceShell';

import { WorkspaceAccountMenu } from './WorkspaceAccountMenu';

import { SidebarBrand } from '@/ui/shell/SidebarBrand';

/** My Store navigation. Server layouts enforce assortment permissions. */
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
} from '@/ui/primitives/sidebar';
import type { CurrentProfile, PermissionKey } from '@/lib/admin.types';
import type { ActiveImpersonation } from '@/lib/impersonation.types';
import {
  ArrowLeft,
  CreditCard,
  Layers,
  LayoutDashboard,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type RetailerNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionKey;
};

const RETAILER_LINKS: RetailerNavLink[] = [
  {
    href: '/my-store',
    label: 'Overview',
    icon: LayoutDashboard,
    permission: 'admin.manage_assortments',
  },
  {
    href: '/my-store/assortments',
    label: 'Assortments',
    icon: Layers,
    permission: 'admin.manage_assortments',
  },
  {
    href: '/my-store/test-show',
    label: 'Test a show',
    icon: PlayCircle,
    permission: 'admin.manage_assortments',
  },
  {
    href: '/my-store/credits',
    label: 'Credits',
    icon: CreditCard,
    permission: 'admin.manage_assortments',
  },
];

function isActivePath(pathname: string | null, href: string) {
  return pathname === href || (href !== '/my-store' && Boolean(pathname?.startsWith(`${href}/`)));
}

function pageTitleFor(pathname: string | null) {
  const match = RETAILER_LINKS.find((link) => isActivePath(pathname, link.href));
  return match?.label ?? 'Overview';
}

function RetailerNavItem({ link, active }: { link: RetailerNavLink; active: boolean }) {
  const Icon = link.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={link.label}>
        <Link href={link.href} prefetch={false}>
          <Icon size={16} strokeWidth={2} />
          <span>{link.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function BackToHomeItem() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip="Back to home">
        <Link href="/home" prefetch={false}>
          <ArrowLeft size={16} strokeWidth={2} />
          <span>Back to home</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function BackToAdminItem() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip="Back to admin">
        <Link href="/admin" prefetch={false}>
          <ArrowLeft size={16} strokeWidth={2} />
          <span>Back to admin</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function MyStoreShell({
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

  return (
    <WorkspaceShell
      initialSidebarCollapsed={initialSidebarCollapsed}
      hasInitialSidebarCollapsedCookie={hasInitialSidebarCollapsedCookie}
      themePreference={profile.themePreference}
    >
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarBrand href="/my-store" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>My Store</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {RETAILER_LINKS.filter((link) => profile.permissions.includes(link.permission)).map(
                  (link) => (
                    <RetailerNavItem
                      key={link.href}
                      link={link}
                      active={isActivePath(pathname, link.href)}
                    />
                  ),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <WorkspaceAccountMenu profile={profile} impersonation={impersonation}>
          <SidebarMenu>
            <BackToHomeItem />
            {profile.permissions.includes('admin.view') ? <BackToAdminItem /> : null}
          </SidebarMenu>
        </WorkspaceAccountMenu>
      </Sidebar>

      <WorkspaceContent
        header={
          <WorkspaceHeader navigationLabel="Open My Store navigation">
            <span className="text-foreground truncate text-sm font-medium">
              {pageTitleFor(pathname)}
            </span>
          </WorkspaceHeader>
        }
      >
        {children}
      </WorkspaceContent>
    </WorkspaceShell>
  );
}
