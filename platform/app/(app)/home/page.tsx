/** Authenticated home page with the V1 workspace redesign. */

import { Suspense } from 'react';
import { ExplorePreviewProvider } from '@/app/components/app/ExplorePreviewContext';
import { ExploreRow } from '@/app/components/app/ExploreRow';
import {
  HomeCollectionsSection,
  HomeFeaturedShows,
} from '@/app/components/app/HomeDiscoverySections';
import { EmptyShowsPanel, PromptHero } from '@/app/components/app/ShowSummaryCards';
import { getDashboardSummaryWithTemplates } from '@/lib/show-summary.server';
import { listFireworkSpecifications } from '@/lib/shows.server';
import HomeLoading from './loading';

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 pt-10 sm:pt-14 lg:pt-20">
      <PromptHero />
      <Suspense fallback={<HomeLoading />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}

async function HomeContent() {
  const [{ summary, templates: exploreTemplates }, specifications] = await Promise.all([
    getDashboardSummaryWithTemplates(),
    listFireworkSpecifications(),
  ]);
  const hasShows = summary.recentShows.length > 0;
  const featuredShowTemplates = exploreTemplates.slice(0, 2);
  const explorePreviewTemplates = exploreTemplates.slice(2, 12);

  return hasShows ? (
    <>
      <HomeFeaturedShows templates={featuredShowTemplates} specifications={specifications} />
      <HomeCollectionsSection />

      {explorePreviewTemplates.length > 0 ? (
        <ExplorePreviewProvider specifications={specifications}>
          <ExploreRow title="Explore" templates={explorePreviewTemplates} seeAllHref="/library" />
        </ExplorePreviewProvider>
      ) : null}
    </>
  ) : (
    <EmptyShowsPanel includePromptHero={false} />
  );
}
