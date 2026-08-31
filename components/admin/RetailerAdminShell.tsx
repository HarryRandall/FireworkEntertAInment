'use client';

/**
 * RetailerAdminShell - chrome for the retailer persona. A retailer is a
 * plain `user`-role account granted the `admin.manage_assortments`
 * permission override — never `admin.view`, so it can never reach
 * `/admin/*` (that stays exclusive to developer/owner `admin` accounts).
 * Assortments here reuses the real FIR-178 editor components directly
 * (AssortmentEditor, NewAssortmentButton's logic) rather than duplicating
 * them, just hosted under /my-store so a retailer never needs
 * admin.view to use it. See FIR-166.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CircleUser,
  CreditCard,
  LayoutDashboard,
  Layers,
  LogOut,
  PlayCircle,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { BrandLockup } from '@/components/design-system/BrandMark';
import { ImpersonationBanner } from '@/components/shell/ImpersonationBanner';
import { ThemePreferenceSync } from '@/components/theme/ThemePreferenceSync';
import { useSidebarPreference } from '@/components/shell/useSidebarPreference';
import { GeneratedAvatar } from '@/components/design-system/GeneratedAvatar';
import { SkipLink } from '@/components/design-system/SkipLink';
import { toast } from '@/components/design-system/toast';
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
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { SIDEBAR_BRAND_BUTTON_CLASS } from '@/components/shell/shell-utils';
import { signOutCurrentSession } from '@/components/shell/sign-out.client';
import { cn } from '@/lib/utils';
import type { CurrentProfile, PermissionKey } from '@/lib/admin.types';
import type { ActiveImpersonation } from '@/lib/impersonation.types';
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

function RetailerSidebarBrand() {
  return (
    <div className="flex min-w-0 items-center gap-1 group-data-[collapsible=icon]:justify-center">
      <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="lg"
            tooltip="ShowCrafter"
            className={SIDEBAR_BRAND_BUTTON_CLASS}
          >
            <Link href="/my-store" prefetch={false}>
              <BrandLockup
                className="w-full gap-0 text-lg group-data-[collapsible=icon]:justify-center"
                markClassName="group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:translate-y-0"
                labelClassName="group-data-[collapsible=icon]:hidden"
              />
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarTrigger className="h-10 w-10 shrink-0 cursor-pointer" />
    </div>
  );
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

function ProfileMenuButton({
  profile,
  onSignOut,
}: {
  profile: CurrentProfile;
  onSignOut: () => Promise<void>;
}) {
  const displayName = profile.fullName || profile.email || 'Admin';
  const secondaryLine = profile.fullName && profile.email ? profile.email : 'My Store';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <GeneratedAvatar name={displayName} email={secondaryLine} />
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="text-muted-foreground truncate text-xs">{secondaryLine}</span>
              </div>
              <Settings className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side="right"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <GeneratedAvatar name={displayName} email={secondaryLine} />
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="text-muted-foreground truncate text-xs">{secondaryLine}</span>
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

export function RetailerAdminShell({
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
          <RetailerSidebarBrand />
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
          <ProfileMenuButton profile={profile} onSignOut={handleSignOut} />
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
