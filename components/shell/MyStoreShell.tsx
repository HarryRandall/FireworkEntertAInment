'use client';

import { ProfileMenu } from '@/components/shell/ProfileMenu';
import { SidebarBrand } from '@/components/shell/SidebarBrand';

/** My Store navigation. Server layouts enforce assortment permissions. */
import { SkipLink } from '@/components/design-system/SkipLink';
import { toast } from '@/components/design-system/toast';
import { ImpersonationBanner } from '@/components/shell/ImpersonationBanner';
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
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import type { CurrentProfile, PermissionKey } from '@/lib/admin.types';
import type { ActiveImpersonation } from '@/lib/impersonation.types';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  CreditCard,
  Layers,
  LayoutDashboard,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';

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
  const router = useRouter();
  const pathname = usePathname();
  const { sidebarCollapsed, sidebarTransitionReady, setSidebarCollapsedPreference } =
    useSidebarPreference({
      initialCollapsed: initialSidebarCollapsed,
      hasInitialCookie: hasInitialSidebarCollapsedCookie,
    });

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

        <SidebarFooter>
          {impersonation ? (
            <ImpersonationBanner impersonation={impersonation} collapsed={sidebarCollapsed} />
          ) : null}
          <SidebarMenu>
            <BackToHomeItem />
            {profile.permissions.includes('admin.view') ? <BackToAdminItem /> : null}
          </SidebarMenu>
          <ProfileMenu
            profile={{
              displayName: profile.fullName || profile.email || 'Account',
              secondaryLine: profile.fullName && profile.email ? profile.email : '',
            }}
            onSignOut={handleSignOut}
          />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/85 border-border flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur sm:px-6">
          <SidebarTrigger className="shrink-0 md:hidden" aria-label="Open My Store navigation" />
          <span className="text-foreground truncate text-sm font-medium">
            {pageTitleFor(pathname)}
          </span>
        </header>
        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
