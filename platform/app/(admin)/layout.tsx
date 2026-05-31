/** Admin route-group layout; enforces RBAC and renders the `AdminShell` chrome. */

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/app/components/admin/AdminShell';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { requirePermission } from '@/lib/admin.server';
import { measureServerTask } from '@/lib/perf.server';

export const dynamic = 'force-dynamic';

export default async function AdminRouteGroupLayout({ children }: { children: ReactNode }) {
  const [profile, impersonation] = await Promise.all([
    measureServerTask('admin-layout:requirePermission', () => requirePermission('admin.view')),
    measureServerTask('admin-layout:getActiveImpersonation', () => getActiveImpersonation()),
  ]);
  if (!profile) redirect('/dashboard');

  return (
    <AdminShell profile={profile} impersonation={impersonation}>
      {children}
    </AdminShell>
  );
}
