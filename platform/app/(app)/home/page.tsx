/** Authenticated home page with the V1 workspace redesign. */

import { Suspense } from 'react';
import { ExplorePreviewProvider } from '@/app/components/app/ExplorePreviewContext';
import { ExploreRow } from '@/app/components/app/ExploreRow';
import {
  HomeCollectionsSection,
  HomeFeaturedShows,
} from '@/app/components/app/HomeDiscoverySections';
import { EmptyShowsPanel, PromptHero } from '@/app/components/app/ShowSummaryCards';
import { HomeSectionsSkeleton } from '@/app/components/app/HomeLoadingSkeleton';
import { getDashboardSummaryWithTemplates } from '@/lib/show-summary.server';
import { listFireworkSpecifications, ShowsNetworkError } from '@/lib/shows.server';
import type { FireworkSpecification } from '@/lib/show-domain';

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 pt-10 sm:pt-14 lg:pt-20">
      <PromptHero />
      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}

async function HomeContent() {
  const [{ summary, templates: exploreTemplates }, specificationsResult] = await Promise.all([
    getDashboardSummaryWithTemplates(),
    listFireworkSpecifications().then(
      (specifications) => ({ specifications, failed: false as const }),
      (error) => {
        if (error instanceof ShowsNetworkError) {
          console.error('[home] listFireworkSpecifications unavailable:', error);
          return { specifications: [] as FireworkSpecification[], failed: true as const };
        }
        throw error;
      },
    ),
  ]);
  const { specifications } = specificationsResult;
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
