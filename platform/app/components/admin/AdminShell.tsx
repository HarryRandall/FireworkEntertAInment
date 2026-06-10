'use client';

/**
 * AdminShell - admin route chrome built on the shared shadcn sidebar primitive.
 * Admin destinations stay RBAC-gated upstream by server components and middleware.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  CircleUser,
  CreditCard,
  Database,
  EllipsisVertical,
  FileInput,
  LayoutDashboard,
  LogOut,
  MessageSquareDot,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ImpersonationBanner } from '@/app/components/app/ImpersonationBanner';
import { ThemePreferenceSync } from '@/app/components/theme/ThemePreferenceSync';
import { useSidebarPreference } from '@/app/components/app/useSidebarPreference';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import type { CurrentProfile } from '@/lib/admin.types';
import type { ActiveImpersonation } from '@/lib/impersonation.types';

type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const ADMIN_LINKS: AdminNavLink[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/roles', label: 'Roles', icon: ShieldCheck },
  { href: '/admin/suppliers', label: 'Suppliers', icon: Store },
  { href: '/admin/catalogue', label: 'Catalogue', icon: Database },
  { href: '/admin/fireworks', label: 'Fireworks', icon: Rocket },
  { href: '/admin/effects', label: 'Effects', icon: Sparkles },
  { href: '/admin/imports', label: 'Imports', icon: FileInput },
  { href: '/admin/prompts', label: 'Prompts', icon: MessageSquareText },
];

type ProfileSummary = {
  displayName: string;
  secondaryLine: string;
  initials: string;
};

type Breadcrumb = {
  label: string;
  href?: string;
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
  return pathname === href || (href !== '/admin' && Boolean(pathname?.startsWith(`${href}/`)));
}

function getAdminBreadcrumbs(pathname: string | null): Breadcrumb[] {
  const match = ADMIN_LINKS.find((link) => isActivePath(pathname, link.href));
  return [{ label: 'Admin', href: '/admin' }, { label: match?.label ?? 'Overview' }];
}

function SidebarBrand() {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" tooltip="ShowCrafter Admin">
          <Link
            href="/admin"
            prefetch
            onClick={() => {
              if (isMobile) setOpenMobile(false);
            }}
          >
            <span className="brand-logo-mark flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
              <Sparkles size={14} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold tracking-tight">ShowCrafter</span>
              <span className="text-muted-foreground block truncate text-[10px] font-medium tracking-wide uppercase">
                Admin
              </span>
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
    </SidebarMenuItem>
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

function ProfileMenuButton({
  profile,
  onSignOut,
}: {
  profile: ProfileSummary;
  onSignOut: () => Promise<void>;
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar>
                <AvatarFallback>{profile.initials}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{profile.displayName}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {profile.secondaryLine}
                </span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar>
                  <AvatarFallback>{profile.initials}</AvatarFallback>
                </Avatar>
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
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mx-1 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
      />
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
                prefetch
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
  const effectivePath = pendingHref ?? pathname;
  const { sidebarCollapsed, sidebarTransitionReady, setSidebarCollapsedPreference } =
    useSidebarPreference({
      initialCollapsed: initialSidebarCollapsed,
      hasInitialCookie: hasInitialSidebarCollapsedCookie,
    });
  const breadcrumbs = getAdminBreadcrumbs(effectivePath);
  const displayName = profile.fullName || profile.email || 'Admin';
  const profileSummary: ProfileSummary = {
    displayName,
    secondaryLine: profile.fullName && profile.email ? profile.email : 'Platform admin',
    initials:
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'A',
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
                {ADMIN_LINKS.map((link) => (
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
        </SidebarContent>

        <AdminSidebarFooter
          profile={profileSummary}
          impersonation={impersonation}
          onSignOut={handleSignOut}
        />
      </Sidebar>

      <SidebarInset className="bg-background md:peer-data-[variant=inset]:border-border h-svh min-h-0 overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:max-h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:border">
        <ShellTopBar breadcrumbs={breadcrumbs} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-8 lg:px-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
