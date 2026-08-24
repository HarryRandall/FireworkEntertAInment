/** Retailer-admin route-group layout; enforces RBAC and renders the `RetailerAdminShell` chrome. */

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { RetailerAdminShell } from '@/app/components/admin/RetailerAdminShell';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { requirePermission } from '@/lib/admin.server';
import { measureServerTask } from '@/lib/perf.server';
import {
  parseSidebarCollapsedPreference,
  sidebarCollapsedCookieName,
} from '@/lib/sidebar-preference';

export const dynamic = 'force-dynamic';

// Gated on 'retailer.view' rather than 'admin.view': the retailer role never
// holds 'admin.view' (see the retailer-role migration), so a retailer account
// can open this console but never /admin/*. Admins hold 'retailer.view' too,
// so they keep access from the "Retailer admin" nav link in AdminShell.
export default async function RetailerAdminRouteGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [profile, impersonation, cookieStore] = await Promise.all([
    measureServerTask('retailer-admin-layout:requirePermission', () =>
      requirePermission('retailer.view'),
    ),
    measureServerTask('retailer-admin-layout:getActiveImpersonation', () =>
      getActiveImpersonation(),
    ),
    cookies(),
  ]);
  if (!profile) redirect('/home');
  const sidebarPreference = parseSidebarCollapsedPreference(
    cookieStore.get(sidebarCollapsedCookieName)?.value,
  );

  return (
    <RetailerAdminShell
      profile={profile}
      impersonation={impersonation}
      initialSidebarCollapsed={sidebarPreference ?? false}
      hasInitialSidebarCollapsedCookie={sidebarPreference !== null}
    >
      {children}
    </RetailerAdminShell>
  );
}
