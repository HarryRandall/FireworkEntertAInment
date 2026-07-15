/** Authenticated home page with the V1 workspace redesign. */

import { Suspense } from 'react';
import { ExplorePreviewProvider } from '@/app/components/app/ExplorePreviewContext';
import { ExploreRow } from '@/app/components/app/ExploreRow';
import {
  HomeCollectionsSection,
  HomeFeaturedShows,
} from '@/app/components/app/HomeDiscoverySections';
import { PromptHero } from '@/app/components/app/ShowSummaryCards';
import { HomeSectionsSkeleton } from '@/app/components/app/HomeLoadingSkeleton';
import { listShowTemplates } from '@/lib/admin.server';
import { listFireworkProducts } from '@/lib/shows.server';

export default function HomePage() {
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
  const [exploreTemplates, specifications] = await Promise.all([
    listShowTemplates(),
    listFireworkProducts(),
  ]);
  const featuredShowTemplates = exploreTemplates.slice(0, 2);
  const explorePreviewTemplates = exploreTemplates.slice(2, 12);

  return (
    <>
      <HomeFeaturedShows templates={featuredShowTemplates} specifications={specifications} />
      <HomeCollectionsSection />

      {explorePreviewTemplates.length > 0 ? (
        <ExplorePreviewProvider>
          <ExploreRow title="Explore" templates={explorePreviewTemplates} seeAllHref="/library" />
        </ExplorePreviewProvider>
      ) : null}
    </>
  );
}
