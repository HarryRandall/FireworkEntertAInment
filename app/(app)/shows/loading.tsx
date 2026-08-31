'use client';

/** Loading fallback for the whole `/shows` segment.
 *
 *  This boundary sits above both the `/shows` list page AND the async
 *  `[id]/layout` (which fetches the show for its tab chrome). Because the
 *  layout suspends here, a naive list-grid skeleton would flash when entering a
 *  show. Instead we branch on the target pathname: the index keeps the list
 *  grid, and detail routes render the show-detail chrome with the skeleton for
 *  the tab being opened (preview by default), so navigating into a show shows
 *  the right skeleton straight away. Once the layout resolves, each sub-route's
 *  own `loading.tsx` takes over seamlessly. */

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, ListFilter, Search } from 'lucide-react';
import { GeneratingShowAnimation } from '@/app/components/app/GeneratingShowAnimation';
import { GENERATING_ROUTE_SPLASH_CLASS } from '@/app/components/app/generatingSplashLayout';
import { Skeleton } from '@/app/components/ui/Feedback';
import { ShowDetailContentSkeleton } from './[id]/ShowDetailContentSkeleton';
import { ShowTabs } from './[id]/ShowTabs';
import { getShowDetailSection } from './[id]/show-detail-sections';
import { WizardLoading } from './new/_components/WizardLoading';

const SHOWS_LIST_SKELETON_COUNT = 24;

/** Card-grid placeholder for the `/shows` list. The search bar and sort control
 *  stay as real chrome so the toolbar never flashes to a skeleton. */
function ShowsListSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5" aria-label="Loading shows">
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">My shows</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Search, preview and continue editing your saved show plans.
        </p>
      </header>
      <section className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative min-w-0">
            <span className="sr-only">Search shows</span>
            <Search
              size={17}
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[color:var(--color-content-muted)]"
            />
            <input
              disabled
              placeholder="Search shows or songs"
              className="border-input bg-background text-foreground placeholder:text-muted-foreground h-11 w-full rounded-xl border pr-12 pl-11 text-sm shadow-xs"
            />
          </label>
          <div className="border-input bg-background text-foreground inline-flex h-11 items-center justify-between rounded-xl border px-4 text-sm sm:min-w-36">
            <span className="inline-flex min-w-0 items-center gap-2">
              <ListFilter size={16} className="shrink-0 text-[color:var(--color-content-subtle)]" />
              <span className="min-w-0 truncate">Last edited</span>
            </span>
            <ChevronDown size={16} className="shrink-0 text-[color:var(--color-content-subtle)]" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
          {Array.from({ length: SHOWS_LIST_SKELETON_COUNT }).map((_, index) => (
            <div key={index} className="min-w-0">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <div className="mt-2.5 space-y-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Mirrors the `[id]/layout` tabs and actions while the show lookup resolves. */
function ShowDetailChromeSkeleton({
  children,
  segment,
  showSlug,
}: {
  children: ReactNode;
  segment: string | undefined;
  showSlug: string;
}) {
  const activeSection = getShowDetailSection(segment);

  return (
    <div
      className="mx-auto w-full max-w-[1600px] space-y-6"
      aria-label="Loading show"
      aria-busy="true"
    >
      <h1 className="sr-only">Show details</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ShowTabs id={showSlug} prefetch={false} />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        Loading {activeSection.label.toLowerCase()}…
      </span>
      {children}
    </div>
  );
}

export default function ShowsLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const generatingKey = pathname?.match(/\/shows\/([^/]+)\/generating\/?$/)?.[1];
  if (generatingKey) {
    const showTitle = searchParams.get('t')?.trim() || undefined;
    const hasAudio = searchParams.get('a') === '1';
    return (
      <GeneratingShowAnimation
        showTitle={showTitle}
        hasAudio={hasAudio}
        phase={hasAudio ? 'analysing' : 'generating'}
        persistKey={generatingKey}
        className={GENERATING_ROUTE_SPLASH_CLASS}
      />
    );
  }

  // `/shows/new` is the wizard, not a show detail page. Without this branch,
  // it matches the detail regex below and flashes the preview skeleton.
  if (pathname === '/shows/new' || pathname?.startsWith('/shows/new/')) {
    return <WizardLoading />;
  }

  // A detail route is `/shows/<something>[/tab]`; anything else is the list.
  const detailMatch = pathname?.match(/^\/shows\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!detailMatch) {
    return <ShowsListSkeleton />;
  }

  return (
    <ShowDetailChromeSkeleton showSlug={detailMatch[1]} segment={detailMatch[2]}>
      <ShowDetailContentSkeleton segment={detailMatch[2]} />
    </ShowDetailChromeSkeleton>
  );
}
