/** Authenticated home page with the V1 workspace redesign. */

import { Suspense } from 'react';
import { ExplorePreviewProvider } from '@/ui/explore/ExplorePreviewContext';
import { ExploreRow } from '@/ui/explore/ExploreRow';
import { HomeCollectionsSection, HomeFeaturedShows } from '@/ui/home/HomeDiscoverySections';
import { PromptHero } from '@/ui/shows/ShowSummaryCards';
import { HomeSectionsSkeleton } from '@/ui/home/HomeLoadingSkeleton';
import { listShowTemplates } from '@/lib/admin/templates.server';

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
