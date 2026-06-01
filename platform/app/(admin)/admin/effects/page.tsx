/** Admin effects page listing colourless base firework effects. */

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
import { TablePagination } from '@/app/components/ui/TablePagination';
import { listAdminEffects } from '@/lib/admin.server';
import { formatStableDateTime } from '@/lib/show-domain';

const BASE_EFFECT_PAGE_SIZE = 12;

type PageProps = {
  searchParams: Promise<{
    q?: string;
    family?: string;
    source?: string;
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
        description="Colourless base patterns used by firework variants."
      />

      <Suspense
        fallback={
          <>
            <FilterSkeleton searchPlaceholder="Search name, slug, description..." />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TableSkeleton
                rows={BASE_EFFECT_PAGE_SIZE}
                headers={[
                  'Preview',
                  'Effect',
                  'Family',
                  'Pattern',
                  'Source',
                  'Variants',
                  'Updated',
                  'Open',
                ]}
              />
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
  const familyFilter = params.family;
  const sourceFilter = params.source;
  const requestedPage = Number(params.page ?? '1');
  const effects = await listAdminEffects();

  const familyOptions = Array.from(new Set(effects.map((effect) => effect.family)))
    .sort()
    .map((value) => ({ value, label: value }));
  const sourceOptions = Array.from(new Set(effects.map((effect) => effect.source)))
    .sort()
    .map((value) => ({ value, label: value }));

  const filtered = effects.filter((effect) => {
    const text = [
      effect.name,
      effect.slug,
      effect.description,
      effect.family,
      effect.patternKey,
      effect.source,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesFamily = !familyFilter || effect.family === familyFilter;
    const matchesSource = !sourceFilter || effect.source === sourceFilter;
    return matchesQuery && matchesFamily && matchesSource;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / BASE_EFFECT_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * BASE_EFFECT_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + BASE_EFFECT_PAGE_SIZE);

  return (
    <>
      <FilterBar
        searchPlaceholder="Search name, slug, description…"
        filters={[
          { key: 'family', label: 'Family', type: 'select', options: familyOptions },
          { key: 'source', label: 'Source', type: 'select', options: sourceOptions },
        ]}
      />

      <DataTableShell
        viewport
        footer={
          totalPages > 1 ? (
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              searchParams={params}
              className="mt-0"
            />
          ) : null
        }
      >
        <table className={tableClasses('min-w-[1080px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Preview</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Effect</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Family</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Pattern</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Source</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Variants</th>
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
                  <div className="max-w-xs truncate font-medium text-[color:var(--color-content-emphasis)]">
                    {effect.name}
                  </div>
                  <div className="mt-1 max-w-md truncate text-xs text-[color:var(--color-content-subtle)]">
                    {effect.description ?? effect.slug}
                  </div>
                </td>
                <td className={tableCellClasses('px-5 py-4')}>
                  <Badge tone="accent" solid icon={Sparkles}>
                    {effect.family}
                  </Badge>
                </td>
                <td className={tableCellClasses('px-5 py-4')}>
                  <span className="font-mono text-xs whitespace-nowrap text-[color:var(--color-content-subtle)]">
                    {effect.patternKey}
                  </span>
                </td>
                <td className={tableCellClasses('px-5 py-4')}>
                  <Badge tone="neutral">{effect.source}</Badge>
                </td>
                <td
                  className={tableCellClasses(
                    'px-5 py-4 font-mono text-xs whitespace-nowrap text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {effect.variantCount}
                </td>
                <td
                  className={tableCellClasses(
                    'px-5 py-4 font-mono text-xs whitespace-nowrap text-[color:var(--color-content-subtle)] tabular-nums',
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
    </>
  );
}
