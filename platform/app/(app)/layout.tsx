/** App shell layout for the `(app)` route group; wraps every page in `AppShell`. Browse pages render for guests too, while private routes are gated by middleware. */

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { AppShell } from '@/app/components/app/AppShell';
import { getCurrentProfile } from '@/lib/admin.server';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { measureServerTask } from '@/lib/perf.server';
import {
  parseSidebarCollapsedPreference,
  sidebarCollapsedCookieName,
} from '@/lib/sidebar-preference';

// App routes are dynamic so the profile check reflects the current session,
// even for guest browsing.
export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const [profile, impersonation, cookieStore] = await Promise.all([
    measureServerTask('app-layout:getCurrentProfile', () => getCurrentProfile()),
    measureServerTask('app-layout:getActiveImpersonation', () => getActiveImpersonation()),
    cookies(),
  ]);

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
