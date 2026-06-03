/** Authenticated app shell layout for the `(app)` route group; redirects unauthenticated users to /login and wraps every page in `AppShell`. */

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/app/components/app/AppShell';
import { getCurrentProfile } from '@/lib/admin.server';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { measureServerTask } from '@/lib/perf.server';
import {
  parseSidebarCollapsedPreference,
  sidebarCollapsedCookieName,
} from '@/lib/sidebar-preference';

// Authenticated routes always need a fresh session check.
export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const [profile, cookieStore] = await Promise.all([
    measureServerTask('app-layout:getCurrentProfile', () => getCurrentProfile()),
    cookies(),
  ]);
  if (!profile) redirect('/login');

  const impersonation = await measureServerTask('app-layout:getActiveImpersonation', () =>
    getActiveImpersonation(),
  );
  const sidebarPreference = parseSidebarCollapsedPreference(
    cookieStore.get(sidebarCollapsedCookieName)?.value,
  );

  return (
    <AppShell
      profile={profile}
      impersonation={impersonation}
      initialSidebarCollapsed={sidebarPreference ?? false}
      hasInitialSidebarCollapsedCookie={sidebarPreference !== null}
    >
      {children}
    </AppShell>
  );
}
