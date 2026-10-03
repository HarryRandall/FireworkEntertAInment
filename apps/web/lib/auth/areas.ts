/** Shared area policy for server guards and workspace configuration. */
export type Area = 'retailer' | 'admin' | 'supplier' | 'account';
export type AccessIdentity = {
  status: string;
  anonymous: boolean;
  staffRole: string | null;
  retailerRoles: readonly string[];
  supplierRoles: readonly string[];
};
const staffRoles = ['super_admin', 'catalogue_editor', 'reviewer', 'support', 'finance'];
/** Canonical destinations and access rules shared with the workspace shell. */
export const areas = {
  retailer: { label: 'Retailer', href: '/retailer' },
  admin: { label: 'Admin', href: '/admin' },
  supplier: { label: 'Supplier', href: '/supplier' },
  account: { label: 'Shopper account', href: '/account' },
} as const;
/** Checks active, permanent identities against table-backed staff and membership roles. */
export function canAccessArea(area: Area, identity: AccessIdentity): boolean {
  if (identity.status !== 'active' || identity.anonymous) return false;
  const staff = identity.staffRole !== null && staffRoles.includes(identity.staffRole);
  switch (area) {
    case 'admin':
      return staff;
    case 'retailer':
      return (
        staff || identity.retailerRoles.some((role) => ['owner', 'manager', 'staff'].includes(role))
      );
    case 'supplier':
      return staff || identity.supplierRoles.some((role) => ['owner', 'member'].includes(role));
    case 'account':
      return true;
  }
}
/** Chooses a workspace destination from the same access policy used by guards. */
export function landingArea(identity: AccessIdentity): string {
  for (const area of ['admin', 'retailer', 'supplier', 'account'] as const) {
    if (canAccessArea(area, identity)) return areas[area].href;
  }
  return '/access-denied';
}
/** Accepts same-origin app paths and rejects browser-normalised open redirects. */
export function safeDestination(value: unknown, fallback = '/account'): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\x00-\x20]/.test(value)
  )
    return fallback;
  const destination = new URL(value, 'https://showcrafter.invalid');
  return destination.origin === 'https://showcrafter.invalid'
    ? destination.pathname + destination.search
    : fallback;
}
