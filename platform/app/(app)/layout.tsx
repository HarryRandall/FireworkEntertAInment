/** Authenticated app shell layout for the `(app)` route group; redirects unauthenticated users to /login and wraps every page in `AppShell`. */

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/app/components/app/AppShell';
import { getCurrentProfile } from '@/lib/admin.server';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { measureServerTask } from '@/lib/perf.server';

// Authenticated routes always need a fresh session check.
export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const profile = await measureServerTask('app-layout:getCurrentProfile', () =>
    getCurrentProfile(),
  );
  if (!profile) redirect('/login');

  const impersonation = await measureServerTask('app-layout:getActiveImpersonation', () =>
    getActiveImpersonation(),
  );

  return (
    <AppShell profile={profile} impersonation={impersonation}>
      {children}
    </AppShell>
  );
}
