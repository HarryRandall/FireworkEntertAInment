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
import {
  ListSkeleton,
  ReplayPanelSkeleton,
  ShoppingListSkeleton,
  SongContextSkeleton,
} from '@/app/components/app/RouteSkeletons';
import { Skeleton } from '@/app/components/ui/Feedback';
import { WizardLoading } from './new/_components/WizardLoading';

const GENERATING_SPLASH_CLASS = '-mx-6 -my-6 flex-1 sm:-mx-8 lg:-mx-10';
const DETAIL_TAB_LABELS = ['Live preview', 'Shopping list', 'Show guide', 'Song context'];
const SHOWS_LIST_SKELETON_COUNT = 24;

/** Card-grid placeholder for the `/shows` list. The search bar and sort control
 *  stay as real chrome so the toolbar never flashes to a skeleton. */
function ShowsListSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5" aria-label="Loading shows">
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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

/** Mirrors the `[id]/layout` chrome (tab row + Refine/Export) so the tabs do not
 *  jump in when the layout resolves. */
function ShowDetailChromeSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6" aria-label="Loading show">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 pb-4">
          {DETAIL_TAB_LABELS.map((label) => (
            <Skeleton key={label} className="h-4 w-24 rounded" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>
      {children}
    </div>
  );
}

function detailContentFor(tab: string | undefined): ReactNode {
  switch (tab) {
    case 'shopping-list':
      return <ShoppingListSkeleton />;
    case 'show-guide':
      return (
        <div className="max-w-3xl">
          <ListSkeleton rows={8} />
        </div>
      );
    case 'timeline':
      return <SongContextSkeleton />;
    // The base `/shows/[id]` route redirects to `/preview`, so preview is the
    // right default for both the explicit preview tab and the bare detail URL.
    case 'preview':
    default:
      return <ReplayPanelSkeleton />;
  }
}

export default function ShowsLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const generatingKey = pathname?.match(/\/shows\/([^/]+)\/generating\/?$/)?.[1];
  if (generatingKey) {
    const showTitle = searchParams.get('t')?.trim() || undefined;
    return (
      <GeneratingShowAnimation
        showTitle={showTitle}
        persistKey={generatingKey}
        className={GENERATING_SPLASH_CLASS}
      />
    );
  }

  // `/shows/new` is the wizard, not a show detail page — without this branch
  // it matches the detail regex below and flashes the preview skeleton.
  if (pathname === '/shows/new' || pathname?.startsWith('/shows/new/')) {
    return <WizardLoading />;
  }

  // A detail route is `/shows/<something>[/tab]`; anything else is the list.
  const detailMatch = pathname?.match(/^\/shows\/[^/]+(?:\/([^/]+))?\/?$/);
  if (!detailMatch) {
    return <ShowsListSkeleton />;
  }

  return <ShowDetailChromeSkeleton>{detailContentFor(detailMatch[1])}</ShowDetailChromeSkeleton>;
}
