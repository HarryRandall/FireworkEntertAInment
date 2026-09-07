import {
  Bell,
  Box,
  CreditCard,
  Download,
  Gauge,
  Home,
  Music4,
  Shield,
  ShieldCheck,
  Star,
  Store,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionKey } from '@/lib/admin.types';

export type AppNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  badge?: string;
};

export const APP_LINKS: readonly AppNavLink[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/shows', label: 'My shows', icon: Music4 },
  { href: '/library', label: 'Explore', icon: Star },
  { href: '/catalogue', label: 'Catalogue', icon: Box },
  { href: '/exports', label: 'Exports', icon: Download },
  { href: '/safety', label: 'Safety', icon: TriangleAlert },
  // No permission gate: every signed-in account is a retailer in this
  // product (consumers never get an account at all — they only ever reach
  // the QR entry route). See FIR-166.
  { href: '/my-store', label: 'My Store', icon: Store },
  { href: '/admin', label: 'Admin', icon: Shield, permission: 'admin.view' },
];

export const SETTINGS_LINKS: readonly AppNavLink[] = [
  { href: '/settings/profile', label: 'Personal details', icon: UserRound },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings/usage', label: 'Usage', icon: Gauge },
  { href: '/settings/security', label: 'Security', icon: ShieldCheck },
];

const SETTINGS_BREADCRUMB_LABELS: Readonly<Record<string, string>> = {
  '/settings': 'Settings',
  '/settings/profile': 'Profile',
  '/settings/usage': 'Usage',
  '/settings/notifications': 'Notifications',
  '/settings/billing': 'Billing',
  '/settings/security': 'Security',
};

const SHOW_SUBPAGE_LABELS: Readonly<Record<string, string>> = {
  preview: 'Preview',
  timeline: 'Timeline',
  'shopping-list': 'Shopping list',
  'show-guide': 'Show guide',
  generating: 'Generating',
};

export type ShellBreadcrumb = {
  label: string;
  href?: string;
  icon?: LucideIcon;
};

export type PendingRouteKind = 'home' | 'library';

export function isActivePath(pathname: string | null, href: string): boolean {
  if (href === '/shows') {
    const isNewShow = pathname === '/shows/new' || pathname?.startsWith('/shows/new/');
    return pathname === '/shows' || Boolean(pathname?.startsWith('/shows/') && !isNewShow);
  }

  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

export function formatPathSegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Preserve malformed external path segments rather than breaking the shell.
  }

  return decoded.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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

export function getAppBreadcrumbs(pathname: string | null): ShellBreadcrumb[] {
  const path = normaliseAppPath(pathname);
  if (path === '/home') return [{ label: 'Home', icon: Home }];
  if (path.startsWith('/settings')) return getSettingsBreadcrumbs(path);

  const segments = path.split('/').filter(Boolean);
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

export function normaliseAppPath(pathname: string | null | undefined): string {
  const pathOnly = (pathname ?? '/home').split(/[?#]/)[0];
  return pathOnly.replace(/\/+$/, '') || '/home';
}

export function isHomePath(pathname: string | null): boolean {
  return normaliseAppPath(pathname) === '/home';
}

export function getPendingRouteKind(pathname: string | null | undefined): PendingRouteKind | null {
  const path = normaliseAppPath(pathname);
  if (path === '/home') return 'home';
  if (path === '/library') return 'library';
  return null;
}
