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
import { listFireworkProducts, ShowsNetworkError } from '@/lib/shows.server';
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
  const [exploreTemplates, specificationsResult] = await Promise.all([
    listShowTemplates(),
    listFireworkProducts().then(
      (specifications) => ({ specifications, failed: false as const }),
      (error) => {
        if (error instanceof ShowsNetworkError) {
          console.error('[home] listFireworkProducts unavailable:', error);
          return { specifications: [] as FireworkSpecification[], failed: true as const };
        }
        throw error;
      },
    ),
  ]);
  const { specifications } = specificationsResult;
  const featuredShowTemplates = exploreTemplates.slice(0, 2);
  const explorePreviewTemplates = exploreTemplates.slice(2, 12);

  return (
    <>
      <HomeFeaturedShows templates={featuredShowTemplates} specifications={specifications} />
      <HomeCollectionsSection />

      {explorePreviewTemplates.length > 0 ? (
        <ExplorePreviewProvider specifications={specifications}>
          <ExploreRow title="Explore" templates={explorePreviewTemplates} seeAllHref="/library" />
        </ExplorePreviewProvider>
      ) : null}
    </>
  );
}
