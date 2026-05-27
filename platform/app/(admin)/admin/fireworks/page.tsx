/** Admin fireworks page showing product-level fireworks and their effect shots. */

import Link from 'next/link';
import { Suspense } from 'react';
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
import { listAdminFireworks } from '@/lib/admin.server';
import { formatDuration } from '@/lib/show-domain';

type PageProps = {
  searchParams: Promise<{
    q?: string;
    manufacturer?: string;
    type?: string;
    effect?: string;
    page?: string;
  }>;
};

type FireworksSearchParams = Awaited<PageProps['searchParams']>;

export default async function AdminFireworksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <AppPageHeader
        title="Fireworks"
        description="Product-level fireworks assembled from one or more reusable effects."
      />

      <Suspense
        fallback={
          <>
            <FilterSkeleton />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TableSkeleton rows={TABLE_PAGE_SIZE} columns={8} />
            </div>
          </>
        }
      >
        <FireworksData params={params} />
      </Suspense>
    </div>
  );
}

async function FireworksData({ params }: { params: FireworksSearchParams }) {
  const query = (params.q ?? '').trim().toLowerCase();
  const manufacturerFilter = params.manufacturer;
  const typeFilter = params.type;
  const effectFilter = params.effect;
  const requestedPage = Number(params.page ?? '1');
  const fireworks = await listAdminFireworks();

  const manufacturerOptions = Array.from(
    new Set(fireworks.map((firework) => firework.manufacturer).filter((v): v is string => !!v)),
  )
    .sort()
    .map((value) => ({ value, label: value }));
  const typeOptions = Array.from(
    new Set(fireworks.map((firework) => firework.fireworkType).filter((v): v is string => !!v)),
  )
    .sort()
    .map((value) => ({ value, label: value }));
  const effectOptions = Array.from(new Set(fireworks.flatMap((firework) => firework.effectTypes)))
    .sort()
    .map((value) => ({ value, label: value }));

  const filtered = fireworks.filter((firework) => {
    const text = [
      firework.partNumber,
      firework.name,
      firework.manufacturer,
      firework.fireworkType,
      ...firework.effectNames,
      ...firework.calibers,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesManufacturer = !manufacturerFilter || firework.manufacturer === manufacturerFilter;
    const matchesType = !typeFilter || firework.fireworkType === typeFilter;
    const matchesEffect = !effectFilter || firework.effectTypes.includes(effectFilter);
    return matchesQuery && matchesManufacturer && matchesType && matchesEffect;
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
        searchPlaceholder="Search product, part number, effect…"
        filters={[
          {
            key: 'manufacturer',
            label: 'Manufacturer',
            type: 'select',
            options: manufacturerOptions,
          },
          { key: 'type', label: 'Type', type: 'select', options: typeOptions },
          { key: 'effect', label: 'Effect type', type: 'select', options: effectOptions },
        ]}
      />

      <DataTableShell>
        <table className={tableClasses('min-w-[1120px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Preview</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Product</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Manufacturer</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Type</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Effects</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Calibre</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Shots</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((firework) => (
              <tr key={firework.id} className={tableRowClasses()}>
                <td className={tableCellClasses('px-5 py-4')}>
                  <EffectPreviewIcon preview={firework.preview} />
                </td>
                <td className={tableCellClasses('px-5 py-4')}>
                  <div className="font-medium text-[color:var(--color-content-emphasis)]">
                    {firework.name}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums">
                    {firework.partNumber}
                  </div>
                </td>
                <td
                  className={tableCellClasses('px-5 py-4 text-[color:var(--color-content-subtle)]')}
                >
                  {firework.manufacturer ?? '—'}
                </td>
                <td className={tableCellClasses('px-5 py-4')}>
                  {firework.fireworkType ? (
                    <Badge tone="neutral" solid>
                      {firework.fireworkType}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={tableCellClasses('px-5 py-4')}>
                  <div className="flex max-w-lg flex-wrap gap-2">
                    {firework.effects.length > 0 ? (
                      firework.effects.slice(0, 4).map((effect) => (
                        <Link
                          key={effect.id}
                          href={`/admin/effects/${effect.id}`}
                          className="focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                        >
                          <Badge tone="accent" solid>
                            {effect.name}
                          </Badge>
                        </Link>
                      ))
                    ) : (
                      <span className="text-[color:var(--color-content-subtle)]">—</span>
                    )}
                    {firework.effects.length > 4 ? (
                      <Badge tone="neutral">+{firework.effects.length - 4}</Badge>
                    ) : null}
                  </div>
                </td>
                <td className={tableCellClasses('px-5 py-4')}>
                  <div className="flex flex-wrap gap-2">
                    {firework.calibers.length > 0 ? (
                      firework.calibers.map((caliber) => (
                        <Badge key={caliber} tone="neutral">
                          {caliber}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[color:var(--color-content-subtle)]">—</span>
                    )}
                  </div>
                </td>
                <td
                  className={tableCellClasses(
                    'px-5 py-4 font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {firework.shotCount}
                </td>
                <td
                  className={tableCellClasses(
                    'px-5 py-4 font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {formatDuration(firework.durationSeconds)}
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
