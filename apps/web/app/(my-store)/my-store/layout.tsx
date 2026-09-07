/** Retailer-admin route-group layout; enforces RBAC and renders the `MyStoreShell` chrome. */

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MyStoreShell } from '@/ui/shell/MyStoreShell';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { requirePermission } from '@/lib/admin.server';
import { measureServerTask } from '@/lib/perf.server';
import {
  parseSidebarCollapsedPreference,
  sidebarCollapsedCookieName,
} from '@/lib/sidebar-preference';

export const dynamic = 'force-dynamic';

// Both assortment workspaces use the same permission; navigation does not grant access.
export default async function RetailerAdminRouteGroupLayout({ children }: { children: ReactNode }) {
  const [profile, impersonation, cookieStore] = await Promise.all([
    measureServerTask('my-store-layout:requirePermission', () =>
      requirePermission('admin.manage_assortments'),
    ),
    measureServerTask('my-store-layout:getActiveImpersonation', () => getActiveImpersonation()),
    cookies(),
  ]);
  if (!profile) redirect('/home');
  const sidebarPreference = parseSidebarCollapsedPreference(
    cookieStore.get(sidebarCollapsedCookieName)?.value,
  );

  return (
    <MyStoreShell
      profile={profile}
      impersonation={impersonation}
      initialSidebarCollapsed={sidebarPreference ?? false}
      hasInitialSidebarCollapsedCookie={sidebarPreference !== null}
    >
      {children}
    </MyStoreShell>
  );
}
