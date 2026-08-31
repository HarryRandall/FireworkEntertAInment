/** Admin route-group layout; enforces RBAC and renders the `AdminShell` chrome. */

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { requirePermission } from '@/lib/admin.server';
import { measureServerTask } from '@/lib/perf.server';
import {
  parseSidebarCollapsedPreference,
  sidebarCollapsedCookieName,
} from '@/lib/sidebar-preference';

export const dynamic = 'force-dynamic';

export default async function AdminRouteGroupLayout({ children }: { children: ReactNode }) {
  const [profile, impersonation, cookieStore] = await Promise.all([
    measureServerTask('admin-layout:requirePermission', () => requirePermission('admin.view')),
    measureServerTask('admin-layout:getActiveImpersonation', () => getActiveImpersonation()),
    cookies(),
  ]);
  if (!profile) redirect('/home');
  const sidebarPreference = parseSidebarCollapsedPreference(
    cookieStore.get(sidebarCollapsedCookieName)?.value,
  );

  return (
    <AdminShell
      profile={profile}
      impersonation={impersonation}
      initialSidebarCollapsed={sidebarPreference ?? false}
      hasInitialSidebarCollapsedCookie={sidebarPreference !== null}
    >
      {children}
    </AdminShell>
  );
}
