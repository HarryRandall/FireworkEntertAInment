/** Admin fireworks page showing product-level fireworks and their effect shots. */

import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { EffectPreviewIcon } from '@/app/components/admin/EffectPreviewIcon';
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
      <Suspense
        fallback={
          <>
            <FilterSkeleton searchPlaceholder="Search product, part number, effect..." />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TableSkeleton
                rows={TABLE_PAGE_SIZE}
                headers={[
                  'Preview',
                  'Product',
                  'Manufacturer',
                  'Type',
                  'Effects',
                  'Calibre',
                  'Shots',
                  'Duration',
                  'Open',
                ]}
                tableClassName="min-w-[1120px]"
              />
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

      <DataTableShell
        viewport
        footer={
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={params}
            visibleItems={paginated.length}
            totalItems={filtered.length}
            itemLabel="firework"
          />
        }
      >
        <table className={tableClasses('min-w-[1120px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses()}>Preview</th>
              <th className={tableHeaderCellClasses()}>Product</th>
              <th className={tableHeaderCellClasses()}>Manufacturer</th>
              <th className={tableHeaderCellClasses()}>Type</th>
              <th className={tableHeaderCellClasses()}>Effects</th>
              <th className={tableHeaderCellClasses()}>Calibre</th>
              <th className={tableHeaderCellClasses()}>Shots</th>
              <th className={tableHeaderCellClasses()}>Duration</th>
              <th className={tableHeaderCellClasses('text-right')}>Open</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((firework) => {
              const visibleEffectCount = firework.effects.length > 4 ? 3 : 4;
              const visibleEffects = firework.effects.slice(0, visibleEffectCount);
              const hiddenEffectCount = firework.effects.length - visibleEffects.length;

              return (
                <tr key={firework.id} className={tableRowClasses()}>
                  <td className={tableCellClasses()}>
                    <EffectPreviewIcon preview={firework.preview} />
                  </td>
                  <td className={tableCellClasses()}>
                    <div className="line-clamp-2 max-w-xs font-medium text-[color:var(--color-content-emphasis)]">
                      {firework.name}
                    </div>
                    <div className="mt-1 font-mono text-xs whitespace-nowrap text-[color:var(--color-content-subtle)] tabular-nums">
                      {firework.partNumber}
                    </div>
                  </td>
                  <td className={tableCellClasses('text-[color:var(--color-content-subtle)]')}>
                    {firework.manufacturer ?? '—'}
                  </td>
                  <td className={tableCellClasses()}>
                    {firework.fireworkType ? (
                      <Badge tone="neutral" solid className="whitespace-nowrap">
                        {firework.fireworkType}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={tableCellClasses()}>
                    <div className="grid max-w-sm grid-cols-2 gap-2">
                      {visibleEffects.length > 0 ? (
                        visibleEffects.map((effect) => (
                          <Link
                            key={effect.id}
                            href={`/admin/effects/${effect.id}`}
                            className="min-w-0 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                          >
                            <Badge
                              tone="accent"
                              solid
                              className="w-full truncate whitespace-nowrap"
                            >
                              {effect.name}
                            </Badge>
                          </Link>
                        ))
                      ) : (
                        <span className="text-[color:var(--color-content-subtle)]">—</span>
                      )}
                      {hiddenEffectCount > 0 ? (
                        <Badge tone="neutral" className="w-full whitespace-nowrap">
                          +{hiddenEffectCount}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className={tableCellClasses()}>
                    <div className="flex max-w-40 flex-nowrap gap-2 overflow-hidden">
                      {firework.calibers.length > 0 ? (
                        firework.calibers.map((caliber) => (
                          <Badge
                            key={caliber}
                            tone="neutral"
                            className="shrink-0 whitespace-nowrap"
                          >
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
                      'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                    )}
                  >
                    {firework.shotCount}
                  </td>
                  <td
                    className={tableCellClasses(
                      'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                    )}
                  >
                    {formatDuration(firework.durationSeconds)}
                  </td>
                  <td className={tableCellClasses('text-right')}>
                    <Link
                      href={`/admin/fireworks/${firework.id}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                      aria-label={`Open ${firework.name}`}
                    >
                      <ArrowRight size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
