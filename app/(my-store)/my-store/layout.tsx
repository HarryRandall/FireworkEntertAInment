/** Retailer-admin route-group layout; enforces RBAC and renders the `RetailerAdminShell` chrome. */

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { RetailerAdminShell } from '@/components/admin/RetailerAdminShell';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { requirePermission } from '@/lib/admin.server';
import { measureServerTask } from '@/lib/perf.server';
import {
  parseSidebarCollapsedPreference,
  sidebarCollapsedCookieName,
} from '@/lib/sidebar-preference';

export const dynamic = 'force-dynamic';

// Gated on 'admin.manage_assortments' — the same permission FIR-178's
// /admin/assortments requires. There's no separate retailer role or
// persona: this console is a focused alternate view for whoever already
// holds that permission, not a distinct login identity (see FIR-166).
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
