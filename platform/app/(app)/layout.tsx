/** App shell layout for the `(app)` route group; wraps every page in `AppShell`. Browse pages render for guests too, while private routes are gated by middleware. */

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { AppShell } from '@/app/components/app/AppShell';
import { getCurrentProfile } from '@/lib/admin.server';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { getAiCreditSummaryForUser } from '@/lib/ai-credits.server';
import { measureServerTask } from '@/lib/perf.server';
import {
  parseSidebarCollapsedPreference,
  sidebarCollapsedCookieName,
} from '@/lib/sidebar-preference';

// App routes are dynamic so the profile check reflects the current session,
// even for guest browsing.
export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const [profile, cookieStore] = await Promise.all([
    measureServerTask('app-layout:getCurrentProfile', () => getCurrentProfile()),
    cookies(),
  ]);

  const [impersonation, aiUsage] = await Promise.all([
    measureServerTask('app-layout:getActiveImpersonation', () => getActiveImpersonation()),
    profile
      ? measureServerTask('app-layout:getAiCreditSummary', () =>
          getAiCreditSummaryForUser(profile.id),
        )
      : null,
  ]);
  const sidebarPreference = parseSidebarCollapsedPreference(
    cookieStore.get(sidebarCollapsedCookieName)?.value,
  );

  return (
    <AppShell
      profile={profile}
      impersonation={impersonation}
      aiUsage={
        aiUsage
          ? {
              balance: aiUsage.balance,
              available: aiUsage.available,
              reserved: aiUsage.reserved,
              includedCredits: aiUsage.includedCredits,
              hourlyLimit: aiUsage.hourlyLimit,
              weeklyLimit: aiUsage.weeklyLimit,
              hourlyUsed: aiUsage.hourlyUsed,
              weeklyUsed: aiUsage.weeklyUsed,
              hourlyRemaining: aiUsage.hourlyRemaining,
              weeklyRemaining: aiUsage.weeklyRemaining,
              totalGranted: aiUsage.totalGranted,
              totalSpent: aiUsage.totalSpent,
            }
          : null
      }
      initialSidebarCollapsed={sidebarPreference ?? false}
      hasInitialSidebarCollapsedCookie={sidebarPreference !== null}
    >
      {children}
    </AppShell>
  );
}
