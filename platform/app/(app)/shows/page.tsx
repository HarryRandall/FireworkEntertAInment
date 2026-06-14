/** My shows page listing every show outside the dashboard. */

import Link from 'next/link';
import { ArrowUpDown, Play, Search } from 'lucide-react';
import { EmptyShowsPanel, PaletteStrip } from '@/app/components/app/ShowSummaryCards';
import { TablePagination } from '@/app/components/ui/TablePagination';
import { getDashboardSummary } from '@/lib/show-summary.server';
import type { ShowSummaryCard } from '@/lib/show-summary';
import { formatBudget, formatDuration } from '@/lib/show-domain';

type SortKey = 'updated' | 'cost' | 'length' | 'name';
const SHOWS_PAGE_SIZE = 10;

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

function formatEditedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function showMeta(show: ShowSummaryCard) {
  return [show.songTitle ?? 'Untitled track', show.style].filter(Boolean).join(' · ');
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

  if (summary.showCount === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <EmptyShowsPanel templates={summary.communityTemplates} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search shows</span>
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--color-content-muted)]"
          />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search shows or songs"
            className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border pr-3 pl-9 text-sm shadow-xs focus:outline-none focus-visible:ring-3"
          />
        </label>
        <label className="relative sm:w-44">
          <span className="sr-only">Sort shows</span>
          <ArrowUpDown
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--color-content-muted)]"
          />
          <select
            name="sort"
            defaultValue={sort}
            className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full appearance-none rounded-md border pr-8 pl-9 text-sm shadow-xs focus:outline-none focus-visible:ring-3"
          >
            {SORTS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring/50 h-10 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors focus:outline-none focus-visible:ring-3"
        >
          Search
        </button>
      </form>

      <section className="bg-card overflow-hidden rounded-xl border border-[color:var(--color-border-subtle)]">
        {shows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[color:var(--color-border-subtle)] text-xs text-[color:var(--color-content-muted)] uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Show</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Length</th>
                  <th className="px-4 py-3 font-medium">Cues</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Edited</th>
                  <th className="px-4 py-3 text-right font-medium">Preview</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShows.map((show) => (
                  <tr
                    key={show.id}
                    className="border-b border-[color:var(--color-border-subtle)] last:border-b-0 hover:bg-[color:var(--color-bg-subtle)]/45"
                  >
                    <td className="min-w-72 px-4 py-3">
                      <Link
                        href={`/shows/${show.slug}/preview`}
                        prefetch
                        className="focus-visible:ring-ring/50 grid min-w-0 grid-cols-[auto_1fr] items-center gap-3 rounded-md focus:outline-none focus-visible:ring-3"
                      >
                        <PaletteStrip palette={show.palette} className="h-9 w-1.5" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-[color:var(--color-content-emphasis)]">
                            {show.title}
                          </span>
                          <span className="block truncate text-xs text-[color:var(--color-content-subtle)]">
                            {showMeta(show)}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-[color:var(--color-content-emphasis)] tabular-nums md:table-cell">
                      {formatDuration(show.lengthSeconds)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[color:var(--color-content-emphasis)] tabular-nums">
                      {show.cueCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-[color:var(--color-content-emphasis)] tabular-nums">
                      {formatBudget(show.totalCostCents)}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-[color:var(--color-content-subtle)] lg:table-cell">
                      {formatEditedAt(show.lastEditedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/shows/${show.slug}/preview?autoplay=1`}
                        prefetch
                        aria-label={`Play ${show.title}`}
                        className="focus-visible:ring-ring/50 inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-emphasis)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:ring-3"
                      >
                        <Play size={15} fill="currentColor" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-[color:var(--color-content-subtle)]">
            No shows match that search.
          </div>
        )}
        {shouldPaginate ? (
          <div className="border-t border-[color:var(--color-border-subtle)] px-4 py-3">
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
