/**
 * Route-level skeleton placeholders shared across the app, browse and
 * replay routes. Each mirrors the layout of its page so the swap to real
 * content does not cause large layout shifts. Admin page skeletons live in
 * app/(admin)/_components/AdminSkeletons.
 */
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ListFilter, Plus, Search } from 'lucide-react';
import { ReplayPanelLoadingStage } from '@/ui/replay/ReplayPanelLoadingStage';
import { Button } from '@/ui/patterns/Button';
import { Skeleton } from '@/ui/patterns/Feedback';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/ui/patterns/DataTable';
import { Input } from '@/ui/patterns/Input';
import { cn } from '@/lib/utils';

const EXPLORE_SKELETON_SHELVES = [
  { title: 'Staff picks', sort: 'featured' },
  { title: 'Most liked', sort: 'popular' },
  { title: 'More to explore', sort: 'curated' },
  { title: 'Recently updated', sort: 'recent' },
  { title: 'Quick bursts', sort: 'shortest' },
] as const;
const LIBRARY_SHELF_SKELETON_COUNT = 8;

function ExploreCardSkeleton({ index, className }: { index: number; className?: string }) {
  const titleWidths = ['w-28', 'w-36', 'w-24', 'w-32'];
  const themeWidths = ['w-24', 'w-32', 'w-20'];

  return (
    <div className={cn('w-44 shrink-0 sm:w-48', className)} aria-hidden>
      <Skeleton className="aspect-[4/5] w-full rounded-xl" />
      <div className="mt-2.5 flex items-center gap-2">
        <Skeleton
          className={cn('h-4 max-w-[calc(100%-3rem)]', titleWidths[index % titleWidths.length])}
        />
        <Skeleton className="ml-auto h-5 w-10 rounded-md" />
      </div>
      <Skeleton className={cn('mt-2 h-3', themeWidths[index % themeWidths.length])} />
      <div className="mt-2 flex items-center gap-3">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-9" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/** Grid of card placeholders for paginated list routes. */
/** Minimal table fallback matching DataTable header + row rhythm. */
export function TableSkeleton({
  rows = 8,
  columns = 5,
  headers,
  tableClassName,
  rowSize = 'default',
}: {
  rows?: number;
  columns?: number;
  headers?: string[];
  tableClassName?: string;
  rowSize?: TableSkeletonRowSize;
}) {
  const tableHeaders = headers ?? Array.from({ length: columns }, () => '');
  return (
    <TableRowsSkeleton
      headers={tableHeaders}
      rows={rows}
      tableClassName={tableClassName}
      rowSize={rowSize}
    />
  );
}

/** Filter bar placeholder for list routes. */
export function FilterSkeleton({
  searchPlaceholder = 'Search…',
  actionLabel,
}: {
  searchPlaceholder?: string;
  actionLabel?: string;
}) {
  return <FilterControlsSkeleton searchPlaceholder={searchPlaceholder} actionLabel={actionLabel} />;
}

/** Skeleton for the `/library` template grid. */
export function LibraryCardsSkeleton() {
  return (
    <div
      className="space-y-8"
      role="status"
      aria-busy="true"
      aria-label="Loading library templates"
    >
      {EXPLORE_SKELETON_SHELVES.map((shelf) => (
        <section key={shelf.sort}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-foreground text-lg font-semibold tracking-tight">{shelf.title}</h2>
            <Link
              href={`/library?sort=${shelf.sort}`}
              className="text-muted-foreground hover:text-foreground border-border inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            >
              See all
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: LIBRARY_SHELF_SKELETON_COUNT }).map((_, index) => (
              <ExploreCardSkeleton key={index} index={index} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Skeleton for a `/library?sort=...` see-all grid; keeps the shelf title chrome. */
export function LibraryGridSkeleton({ title }: { title: string }) {
  return (
    <section
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading library templates"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-foreground text-xl font-semibold tracking-tight">{title}</h2>
          <Skeleton className="mt-1 h-4 w-20" />
        </div>
        <Link
          href="/library"
          className="text-muted-foreground hover:text-foreground border-border inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors"
        >
          <ChevronLeft size={16} />
          Back to shelves
        </Link>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-7">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="min-w-0">
            <ExploreCardSkeleton index={index} className="w-full sm:w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Skeleton for the `/admin` overview dashboard. */
export function TemplateReplaySkeleton() {
  return (
    <div
      className="border-border bg-stage-night relative h-[min(72vh,680px)] min-h-[520px] overflow-hidden rounded-2xl border shadow-[var(--shadow-card-hover)]"
      role="status"
      aria-busy="true"
      aria-label="Loading show replay"
    >
      <ReplayPanelLoadingStage />
    </div>
  );
}

/** Skeleton for the replay panel on the show detail route. */
export function ReplayPanelSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading replay">
      <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
        <div className="bg-stage-night relative h-[min(72vh,680px)] min-h-[520px] overflow-hidden rounded-[inherit]">
          <ReplayPanelLoadingStage />
          <Skeleton className="absolute top-6 right-6 z-20 h-9 w-9 rounded-full bg-white/12" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-stretch">
        <div className="border-border bg-card rounded-lg border p-6 xl:col-span-2">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-9 w-36 rounded-full" />
          </div>
          <DataTableShell>
            <table className={tableClasses('min-w-0 table-fixed')} aria-label="Loading cues">
              <colgroup>
                <col className="w-[88px]" />
                <col />
                <col className="w-[110px]" />
                <col className="w-[56px]" />
              </colgroup>
              <thead className={tableHeadClasses()}>
                <tr>
                  {['Time', 'Firework', 'Mortar', 'Actions'].map((header) => (
                    <th
                      key={header}
                      className={tableHeaderCellClasses(
                        header === 'Actions' ? 'text-right' : undefined,
                      )}
                    >
                      {header === 'Actions' ? <span className="sr-only">Actions</span> : header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className={tableRowClasses()}>
                    <td className={tableCellClasses('h-14')}>
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className={tableCellClasses('h-14')}>
                      <Skeleton className="h-4 w-full max-w-56" />
                    </td>
                    <td className={tableCellClasses('h-14')}>
                      <Skeleton className="h-4 w-14" />
                    </td>
                    <td className={tableCellClasses('h-14 text-right')}>
                      <Skeleton className="ml-auto h-8 w-8 rounded-full" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[4.25rem] rounded-lg" />
            ))}
          </div>
          <div className="border-border bg-card rounded-lg border p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
            <Skeleton className="mt-4 h-32 rounded-xl" />
            <div className="mt-3 flex justify-end">
              <Skeleton className="h-9 w-36 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton matching the song-context tab on the show detail route. */
export function SongContextSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-busy="true" aria-label="Loading song context">
      <div className="border-border/55 bg-card flex items-center gap-4 rounded-lg border p-4">
        <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div className="hidden gap-2 sm:flex">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="border-border/55 bg-card rounded-lg border p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-2 h-3 w-36 max-w-full" />
          </div>
        ))}
      </div>

      <div className="border-border bg-card rounded-lg border p-6">
        <div className="mb-5 space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <div className="bg-card rounded-md p-4">
          <div className="space-y-3">
            {Array.from({ length: 14 }).map((_, index) => (
              <Skeleton key={index} className={index % 4 === 0 ? 'h-3 w-3/5' : 'h-3 w-full'} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton matching the shopping-list card on the show detail route. */
export function ShoppingListSkeleton() {
  return (
    <div
      className="w-full max-w-5xl"
      role="status"
      aria-busy="true"
      aria-label="Loading shopping list"
    >
      <div className="border-border bg-card rounded-lg border p-8">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        </header>

        <div className="mt-6 flex items-center gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-12" />
        </div>

        <div className="mt-6 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="border-border/10 bg-accent/40 flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
          ))}
        </div>

        <div className="border-border/10 mt-6 flex items-center justify-between border-t pt-6">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
    </div>
  );
}

/** Generic vertical list skeleton with `rows` placeholder rows. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 rounded-lg" />
      ))}
    </div>
  );
}

export function FilterControlsSkeleton({
  searchPlaceholder,
  actionLabel,
}: {
  searchPlaceholder: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            readOnly
            tabIndex={-1}
            value=""
            placeholder={searchPlaceholder}
            iconLeft={<Search size={16} />}
            aria-label="Search"
          />
        </div>
        {actionLabel ? (
          <Button
            type="button"
            size="md"
            tabIndex={-1}
            aria-disabled
            className="pointer-events-none"
          >
            <Plus size={16} />
            {actionLabel}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="md"
            tabIndex={-1}
            aria-disabled
            className="pointer-events-none"
          >
            <ListFilter size={16} />
            Filter
          </Button>
        )}
      </div>
    </div>
  );
}

export type TableSkeletonRowSize = 'default' | 'relaxed';

export function TableRowsSkeleton({
  headers,
  rows,
  tableClassName,
  rowSize,
}: {
  headers: string[];
  rows: number;
  tableClassName?: string;
  rowSize: TableSkeletonRowSize;
}) {
  return (
    <DataTableShell
      viewport
      footer={<TablePaginationSkeleton />}
      className="bg-card h-full max-h-full"
    >
      <table className={tableClasses(tableClassName)} aria-label="Loading table">
        <thead className={tableHeadClasses()}>
          <tr>
            {headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className={tableHeaderCellClasses(
                  header === 'Open' || header === 'Actions' ? 'text-right' : undefined,
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className={tableRowClasses()}>
              {headers.map((header, columnIndex) => (
                <td
                  key={`${rowIndex}-${header}-${columnIndex}`}
                  className={tableCellClasses(getTableSkeletonCellWrapperClass(header, rowSize))}
                >
                  <Skeleton className={getTableSkeletonCellClass(header, columnIndex)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}

function getTableSkeletonCellWrapperClass(header: string, rowSize: TableSkeletonRowSize) {
  const padding = rowSize === 'relaxed' ? 'py-5' : 'py-3';
  return header === 'Open' || header === 'Actions' ? `${padding} text-right` : padding;
}

function TablePaginationSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-4 w-44 max-w-full" />
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

function getTableSkeletonCellClass(header: string, columnIndex: number) {
  const normalized = header.toLowerCase();

  if (normalized === 'preview') return 'h-9 w-9 rounded-lg';
  if (normalized === 'open' || normalized === 'actions') return 'ml-auto h-4 w-8';
  if (
    normalized === 'status' ||
    normalized === 'role' ||
    normalized === 'type' ||
    normalized === 'duration' ||
    normalized === 'shots' ||
    normalized === 'calibre' ||
    normalized === 'updated'
  ) {
    return 'h-4 w-16 max-w-full rounded-md';
  }
  if (normalized === 'effects') return 'h-4 w-28 max-w-full rounded-md';
  if (columnIndex === 0) return 'h-4 w-28 max-w-full';
  return 'h-4 w-36 max-w-full';
}
