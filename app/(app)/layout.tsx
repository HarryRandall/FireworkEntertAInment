/** App shell layout for the authenticated `(app)` route group. */

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { getCurrentProfile } from '@/lib/admin.server';
import { getCurrentUserId } from '@/lib/current-user.server';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { measureServerTask } from '@/lib/perf.server';
import {
  parseSidebarCollapsedPreference,
  sidebarCollapsedCookieName,
} from '@/lib/sidebar-preference';

// App routes are dynamic so the profile check reflects the current session,
// with proxy handling the /login?next= round-trip before render.
export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const [profile, impersonation, cookieStore, userId] = await Promise.all([
    measureServerTask('app-layout:getCurrentProfile', () => getCurrentProfile()),
    measureServerTask('app-layout:getActiveImpersonation', () => getActiveImpersonation()),
    cookies(),
    getCurrentUserId(),
  ]);

  if (!userId) {
    redirect('/login');
  }
  if (!profile || profile.status !== 'active') {
    redirect('/account-unavailable');
  }

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
