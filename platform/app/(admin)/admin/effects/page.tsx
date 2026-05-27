/** Admin effects page listing reusable firework effect specs. */

import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { EffectPreviewIcon } from '@/app/components/admin/EffectPreviewIcon';
import { AppPageHeader } from '@/app/components/app/AppPageHeader';
import { FilterSkeleton, TableSkeleton } from '@/app/components/app/RouteSkeletons';
import { Badge } from '@/app/components/ui/Badge';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { FilterBar } from '@/app/components/ui/FilterBar';
import { TABLE_PAGE_SIZE, TablePagination } from '@/app/components/ui/TablePagination';
import { listAdminEffects } from '@/lib/admin.server';
import { formatDuration, formatStableDateTime } from '@/lib/show-domain';

type PageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    source?: string;
    duration_min?: string;
    duration_max?: string;
    page?: string;
  }>;
};

type EffectsSearchParams = Awaited<PageProps['searchParams']>;

export default async function AdminEffectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <AppPageHeader
        title="Effects"
        description="Reusable effect specs that power product shots and previews."
      />

      <Suspense
        fallback={
          <>
            <FilterSkeleton />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TableSkeleton rows={TABLE_PAGE_SIZE} columns={9} />
            </div>
          </>
        }
      >
        <EffectsData params={params} />
      </Suspense>
    </div>
  );
}

async function EffectsData({ params }: { params: EffectsSearchParams }) {
  const query = (params.q ?? '').trim().toLowerCase();
  const typeFilter = params.type;
  const sourceFilter = params.source;
  const minDuration = params.duration_min ? Number(params.duration_min) : null;
  const maxDuration = params.duration_max ? Number(params.duration_max) : null;
  const requestedPage = Number(params.page ?? '1');
  const effects = await listAdminEffects();

  const typeOptions = Array.from(new Set(effects.map((effect) => effect.type)))
    .sort()
    .map((value) => ({ value, label: value }));
  const sourceOptions = Array.from(new Set(effects.map((effect) => effect.source)))
    .sort()
    .map((value) => ({ value, label: value }));

  const filtered = effects.filter((effect) => {
    const text = [effect.name, effect.slug, effect.description, effect.type, effect.source]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesType = !typeFilter || effect.type === typeFilter;
    const matchesSource = !sourceFilter || effect.source === sourceFilter;
    const matchesMin = minDuration == null || effect.durationSeconds >= minDuration;
    const matchesMax = maxDuration == null || effect.durationSeconds <= maxDuration;
    return matchesQuery && matchesType && matchesSource && matchesMin && matchesMax;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

  return (
    <>
      <FilterBar
        searchPlaceholder="Search name, slug, description…"
        filters={[
          { key: 'type', label: 'Type', type: 'select', options: typeOptions },
          { key: 'source', label: 'Source', type: 'select', options: sourceOptions },
          { key: 'duration', label: 'Duration', type: 'range', unit: 's' },
        ]}
      />

      <DataTableShell>
        <table className={tableClasses('min-w-[1120px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Preview</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Effect</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Type</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Source</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Duration</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Height</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Products</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Updated</th>
              <th className={tableHeaderCellClasses('px-5 py-3 text-right')}>Open</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((effect) => (
              <tr key={effect.id} className={tableRowClasses()}>
                <td className={tableCellClasses('px-5 py-4')}>
                  <EffectPreviewIcon preview={effect.preview} />
                </td>
                <td className={tableCellClasses('px-5 py-4')}>
                  <div className="font-medium text-[color:var(--color-content-emphasis)]">
                    {effect.name}
                  </div>
                  <div className="mt-1 max-w-md truncate text-xs text-[color:var(--color-content-subtle)]">
                    {effect.description ?? effect.slug}
                  </div>
                </td>
                <td className={tableCellClasses('px-5 py-4')}>
                  <Badge tone="accent" solid icon={Sparkles}>
                    {effect.type}
                  </Badge>
                </td>
                <td className={tableCellClasses('px-5 py-4')}>
                  <Badge tone="neutral">{effect.source}</Badge>
                </td>
                <td
                  className={tableCellClasses(
                    'px-5 py-4 font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {formatDuration(effect.durationSeconds)}
                </td>
                <td
                  className={tableCellClasses(
                    'px-5 py-4 font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {effect.heightMeters == null ? '—' : `${effect.heightMeters}m`}
                </td>
                <td
                  className={tableCellClasses(
                    'px-5 py-4 font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {effect.productCount}
                </td>
                <td
                  className={tableCellClasses(
                    'px-5 py-4 font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {formatStableDateTime(effect.updatedAt)}
                </td>
                <td className={tableCellClasses('px-5 py-4 text-right')}>
                  <Link
                    href={`/admin/effects/${effect.id}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                    aria-label={`Open ${effect.name}`}
                  >
                    <ArrowRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

      <TablePagination currentPage={currentPage} totalPages={totalPages} searchParams={params} />
    </>
  );
}
