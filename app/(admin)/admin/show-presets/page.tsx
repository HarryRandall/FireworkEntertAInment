/** Admin curated show presets page: Explore/Home shows with draft publishing. */

import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/design-system/Badge';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/components/design-system/DataTable';
import { FilterBar, type FilterConfig } from '@/components/design-system/FilterBar';
import { FilterSkeleton, TableSkeleton } from '@/components/shell/RouteSkeletons';
import { TABLE_PAGE_SIZE, TablePagination } from '@/components/design-system/TablePagination';
import { listAdminShowPresetImportShows, listAdminShowPresets } from '@/lib/admin.server';
import { listShowPresetsForCoverBackfill } from '@/lib/admin/cover-posters.server';
import { formatDuration, formatStableDateTime } from '@/lib/show-domain';
import { DuplicateShowPresetButton, ShowPresetCreateActions } from './ShowPresetActions';

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
};

const FILTERS: FilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'published', label: 'Published' },
      { value: 'draft', label: 'Draft' },
      { value: 'featured', label: 'Featured' },
    ],
  },
];

export default function AdminShowPresetsPage({ searchParams }: PageProps) {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8">
      <Suspense
        fallback={
          <>
            <FilterSkeleton searchPlaceholder="Search curated shows..." actionLabel="New draft" />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TableSkeleton
                rows={TABLE_PAGE_SIZE}
                headers={[
                  'Status',
                  'Show',
                  'Featured',
                  'Cues',
                  'Duration',
                  'Sort',
                  'Updated',
                  'Open',
                ]}
                tableClassName="min-w-[980px]"
              />
            </div>
          </>
        }
      >
        <ShowPresetsData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ShowPresetsData({ searchParams }: { searchParams: PageProps['searchParams'] }) {
  const [params, presets, importableShows, coverPresets] = await Promise.all([
    searchParams,
    listAdminShowPresets(),
    listAdminShowPresetImportShows(),
    listShowPresetsForCoverBackfill(),
  ]);
  const query = (params.q ?? '').trim().toLowerCase();
  const status = params.status;
  const requestedPage = Number(params.page ?? '1');

  const filtered = presets.filter((preset) => {
    const text = [preset.title, preset.slug, preset.theme, preset.description, ...preset.moodTags]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesStatus =
      !status ||
      (status === 'published' && preset.isPublished) ||
      (status === 'draft' && !preset.isPublished) ||
      (status === 'featured' && preset.isFeatured);
    return matchesQuery && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

  return (
    <>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <FilterBar searchPlaceholder="Search curated shows..." filters={FILTERS} />
        </div>
        <ShowPresetCreateActions importableShows={importableShows} coverPresets={coverPresets} />
      </div>

      <DataTableShell
        viewport
        footer={
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={params}
            visibleItems={paginated.length}
            totalItems={filtered.length}
            itemLabel="curated show"
          />
        }
      >
        <table className={tableClasses('min-w-[980px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses()}>Status</th>
              <th className={tableHeaderCellClasses()}>Show</th>
              <th className={tableHeaderCellClasses()}>Source</th>
              <th className={tableHeaderCellClasses()}>Featured</th>
              <th className={tableHeaderCellClasses()}>Cues</th>
              <th className={tableHeaderCellClasses()}>Duration</th>
              <th className={tableHeaderCellClasses()}>Sort</th>
              <th className={tableHeaderCellClasses()}>Updated</th>
              <th className={tableHeaderCellClasses('text-right')}>Open</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((preset) => (
              <tr key={preset.id} className={tableRowClasses()}>
                <td className={tableCellClasses()}>
                  <Badge tone={preset.isPublished ? 'success' : 'neutral'} solid>
                    {preset.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </td>
                <td className={tableCellClasses()}>
                  <div className="line-clamp-2 max-w-md font-medium text-[color:var(--color-content-emphasis)]">
                    {preset.title}
                  </div>
                  <div className="mt-1 font-mono text-xs whitespace-nowrap text-[color:var(--color-content-subtle)] tabular-nums">
                    {preset.slug}
                  </div>
                </td>
                <td className={tableCellClasses()}>
                  <Badge tone={preset.sourceShowId ? 'sky' : 'neutral'}>
                    {preset.sourceShowId ? 'Imported' : 'Curated'}
                  </Badge>
                </td>
                <td className={tableCellClasses()}>
                  {preset.isFeatured ? <Badge tone="accent">Featured</Badge> : '-'}
                </td>
                <td className={tableCellClasses('font-mono text-xs tabular-nums')}>
                  {preset.resolvableCueCount}/{preset.cueCount}
                </td>
                <td className={tableCellClasses('font-mono text-xs tabular-nums')}>
                  {formatDuration(preset.durationSeconds)}
                </td>
                <td className={tableCellClasses('font-mono text-xs tabular-nums')}>
                  {preset.sortOrder}
                </td>
                <td className={tableCellClasses('font-mono text-xs tabular-nums')}>
                  {formatStableDateTime(preset.updatedAt)}
                </td>
                <td className={tableCellClasses('text-right')}>
                  <div className="inline-flex items-center justify-end gap-1">
                    <DuplicateShowPresetButton presetId={preset.id} />
                    <Link
                      href={`/admin/show-presets/${preset.id}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                      aria-label={`Open ${preset.title}`}
                    >
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
