/** Public Explore and catalogue chrome, with the workspace shell retained for signed-in users. */

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { AppShell } from '@/app/components/app/AppShell';
import { MarketingFooter } from '@/app/components/marketing/Footer';
import { MarketingNavBar } from '@/app/components/marketing/NavBar';
import { SkipLink } from '@/app/components/ui/SkipLink';
import { getCurrentProfile } from '@/lib/admin.server';
import { getCurrentUserId } from '@/lib/current-user.server';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import {
  parseSidebarCollapsedPreference,
  sidebarCollapsedCookieName,
} from '@/lib/sidebar-preference';

export const dynamic = 'force-dynamic';

export default async function PublicBrowseLayout({ children }: { children: ReactNode }) {
  const [userId, profile, impersonation, cookieStore] = await Promise.all([
    getCurrentUserId(),
    getCurrentProfile(),
    getActiveImpersonation(),
    cookies(),
  ]);

  if (!userId) {
    return (
      <div className="bg-background text-on-surface flex min-h-screen flex-col">
        <SkipLink />
        <MarketingNavBar />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-grow px-4 py-6 focus:outline-none sm:px-6 lg:px-10 lg:py-8"
        >
          {children}
        </main>
        <MarketingFooter />
      </div>
    );
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
