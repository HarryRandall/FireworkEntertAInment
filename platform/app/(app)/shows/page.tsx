/** My shows page listing every show outside the dashboard. */
import { Suspense } from 'react';
import { EmptyShowsPanel } from '@/app/components/app/ShowSummaryCards';
import { Skeleton } from '@/app/components/ui/Feedback';
import { TablePagination } from '@/app/components/ui/TablePagination';
import { getDashboardSummary } from '@/lib/show-summary.server';
import type { ShowSummaryCard } from '@/lib/show-summary';
import { ShowsToolbar, type ShowsSortKey } from './ShowsToolbar';
import { ShowReplayCoverCard } from './ShowReplayCoverCard';
import { ShowReplayPreviewProvider } from './ShowReplayPreviewContext';

type SortKey = ShowsSortKey;
const SHOWS_PAGE_SIZE = 24;

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'updated', label: 'Last edited' },
  { key: 'cost', label: 'Cost' },
  { key: 'length', label: 'Length' },
  { key: 'name', label: 'Name' },
];

type PageProps = {
  searchParams?: Promise<{
    page?: string;
    q?: string;
    sort?: string;
  }>;
};

function sortShows(shows: ShowSummaryCard[], sort: SortKey) {
  return [...shows].sort((a, b) => {
    if (sort === 'cost') return b.totalCostCents - a.totalCostCents;
    if (sort === 'length') return (b.lengthSeconds ?? 0) - (a.lengthSeconds ?? 0);
    if (sort === 'name') return a.title.localeCompare(b.title);
    return Date.parse(b.lastEditedAt) - Date.parse(a.lastEditedAt);
  });
}

function filterShows(shows: ShowSummaryCard[], query: string) {
  const normalised = query.trim().toLowerCase();
  if (!normalised) return shows;
  return shows.filter((show) =>
    [show.title, show.songTitle, show.artist, show.style]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalised)),
  );
}

function parseSort(value: string | undefined): SortKey {
  return SORTS.some((item) => item.key === value) ? (value as SortKey) : 'updated';
}

function parsePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Card-grid placeholder shown while the streamed grid resolves. The toolbar
 *  renders outside this Suspense boundary so the search bar never skeletonises. */
function ShowsGridSkeleton() {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: SHOWS_PAGE_SIZE }).map((_, index) => (
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
  );
}

export default async function ShowsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const query = params.q ?? '';
  const sort = parseSort(params.sort);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <ShowsToolbar query={query} sort={sort} sorts={SORTS} />
      <Suspense fallback={<ShowsGridSkeleton />}>
        <ShowsGrid query={query} sort={sort} page={params.page} />
      </Suspense>
    </div>
  );
}

async function ShowsGrid({ query, sort, page }: { query: string; sort: SortKey; page?: string }) {
  const summary = await getDashboardSummary();
  const shows = sortShows(filterShows(summary.allShows, query), sort);
  const shouldPaginate = shows.length > SHOWS_PAGE_SIZE;
  const totalPages = shouldPaginate ? Math.ceil(shows.length / SHOWS_PAGE_SIZE) : 1;
  const currentPage = shouldPaginate ? Math.min(parsePage(page), totalPages) : 1;
  const pageStart = (currentPage - 1) * SHOWS_PAGE_SIZE;
  const paginatedShows = shouldPaginate
    ? shows.slice(pageStart, pageStart + SHOWS_PAGE_SIZE)
    : shows;

  if (summary.showCount === 0) {
    return (
      <div className="mx-auto w-full">
        <EmptyShowsPanel />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {shows.length > 0 ? (
        <ShowReplayPreviewProvider>
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {paginatedShows.map((show) => (
              <ShowReplayCoverCard key={show.id} show={show} />
            ))}
          </div>
        </ShowReplayPreviewProvider>
      ) : (
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border-subtle)] p-6 text-sm text-[color:var(--color-content-subtle)]">
          No shows match that search.
        </div>
      )}

      {shows.length > 0 ? (
        <div className="pt-1">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={{ q: query, sort: sort === 'updated' ? undefined : sort }}
            visibleItems={paginatedShows.length}
            totalItems={shows.length}
            itemLabel="show"
          />
        </div>
      ) : null}
    </section>
  );
}
