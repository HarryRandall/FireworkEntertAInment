/** My shows page listing every show outside the dashboard. */
import { EmptyShowsPanel } from '@/app/components/app/ShowSummaryCards';
import { TablePagination } from '@/app/components/ui/TablePagination';
import { getDashboardSummary } from '@/lib/show-summary.server';
import type { ShowSummaryCard } from '@/lib/show-summary';
import { listReplayCuesForShow } from '@/lib/shows.server';
import { ShowsToolbar, type ShowsSortKey } from './ShowsToolbar';
import { ShowReplayCoverCard } from './ShowReplayCoverCard';

type SortKey = ShowsSortKey;
const SHOWS_PAGE_SIZE = 12;

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

function parsePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function ShowsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const query = params.q ?? '';
  const sort = SORTS.some((item) => item.key === params.sort)
    ? (params.sort as SortKey)
    : 'updated';
  const summary = await getDashboardSummary();
  const shows = sortShows(filterShows(summary.allShows, query), sort);
  const shouldPaginate = shows.length > SHOWS_PAGE_SIZE;
  const totalPages = shouldPaginate ? Math.ceil(shows.length / SHOWS_PAGE_SIZE) : 1;
  const currentPage = shouldPaginate ? Math.min(parsePage(params.page), totalPages) : 1;
  const pageStart = (currentPage - 1) * SHOWS_PAGE_SIZE;
  const paginatedShows = shouldPaginate
    ? shows.slice(pageStart, pageStart + SHOWS_PAGE_SIZE)
    : shows;
  const replayCueEntries = await Promise.all(
    paginatedShows.map(async (show) => [show.id, await listReplayCuesForShow(show.id)] as const),
  );
  const replayCuesByShowId = new Map(replayCueEntries);

  if (summary.showCount === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <EmptyShowsPanel templates={summary.communityTemplates} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <ShowsToolbar query={query} resultCount={shows.length} sort={sort} sorts={SORTS} />

      <section className="space-y-4">
        {shows.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {paginatedShows.map((show) => (
              <ShowReplayCoverCard
                key={show.id}
                show={show}
                cues={replayCuesByShowId.get(show.id) ?? []}
              />
            ))}
          </div>
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
              searchParams={params}
              visibleItems={paginatedShows.length}
              totalItems={shows.length}
              itemLabel="show"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
