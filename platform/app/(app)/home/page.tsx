/** Authenticated home page with the V1 workspace redesign. */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ExplorePreviewProvider } from '@/app/components/app/ExplorePreviewContext';
import { ExploreRow } from '@/app/components/app/ExploreRow';
import {
  HomeCollectionsSection,
  HomeFeaturedShows,
} from '@/app/components/app/HomeDiscoverySections';
import { PromptHero } from '@/app/components/app/ShowSummaryCards';
import { HomeSectionsSkeleton } from '@/app/components/app/HomeLoadingSkeleton';
import { getCurrentProfile, listShowTemplates } from '@/lib/admin.server';

export default async function HomePage() {
  // Retailer accounts land here after login (see lib/auth-redirect DEFAULT_AUTH_NEXT_PATH)
  // but the consumer home page isn't their workspace — send them straight to
  // their own console. Checked by permission, not role, so a revoked grant
  // can't produce a redirect loop with the retailer-admin layout's own gate.
  const profile = await getCurrentProfile();
  if (profile?.permissions.includes('retailer.view') && !profile.permissions.includes('admin.view')) {
    redirect('/retailer-admin');
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-7 pt-10 sm:pt-14 lg:pt-20">
      <PromptHero headingLevel="h1" />
      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}

async function HomeContent() {
  const exploreTemplates = await listShowTemplates();
  const featuredShowTemplates = exploreTemplates.slice(0, 2);
  const explorePreviewTemplates = exploreTemplates.slice(2, 12);

  return (
    <>
      <HomeFeaturedShows templates={featuredShowTemplates} />
      <HomeCollectionsSection />

      {explorePreviewTemplates.length > 0 ? (
        <ExplorePreviewProvider>
          <ExploreRow title="Explore" templates={explorePreviewTemplates} seeAllHref="/library" />
        </ExplorePreviewProvider>
      ) : null}
    </>
  );
}
