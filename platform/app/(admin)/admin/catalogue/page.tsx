/** Admin catalogue page listing every firework product available across suppliers. */

import { Suspense } from 'react';
import { FilterSkeleton, TableSkeleton } from '@/app/components/app/RouteSkeletons';
import { Badge } from '@/app/components/ui/Badge';
import { FilterBar } from '@/app/components/ui/FilterBar';
import { TABLE_PAGE_SIZE, TablePagination } from '@/app/components/ui/TablePagination';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { formatDuration } from '@/lib/show-domain';
import { listCatalogueProducts } from '@/lib/admin.server';
import { ProductFormDialog } from './ProductFormDialog';
import { ProductRowActions } from './ProductRowActions';

type PageProps = {
  searchParams: Promise<{
    q?: string;
    manufacturer?: string;
    type?: string;
    duration_min?: string;
    duration_max?: string;
    page?: string;
  }>;
};
type CatalogueSearchParams = Awaited<PageProps['searchParams']>;

export default async function AdminCataloguePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <div className="flex justify-end">
        <ProductFormDialog />
      </div>

      <Suspense
        fallback={
          <>
            <FilterSkeleton searchPlaceholder="Search part #, name, manufacturer..." />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TableSkeleton
                rows={TABLE_PAGE_SIZE}
                headers={['Part', 'Product', 'Manufacturer', 'Type', 'Duration', 'Actions']}
                tableClassName="min-w-[960px]"
                rowSize="relaxed"
              />
            </div>
          </>
        }
      >
        <CatalogueData params={params} />
      </Suspense>
    </div>
  );
}

async function CatalogueData({ params }: { params: CatalogueSearchParams }) {
  const query = (params.q ?? '').trim().toLowerCase();
  const manufacturerFilter = params.manufacturer;
  const typeFilter = params.type;
  const minDuration = params.duration_min ? Number(params.duration_min) : null;
  const maxDuration = params.duration_max ? Number(params.duration_max) : null;
  const requestedPage = Number(params.page ?? '1');

  const products = await listCatalogueProducts();

  const manufacturerOptions = Array.from(
    new Set(products.map((p) => p.manufacturer).filter((v): v is string => Boolean(v))),
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const typeOptions = Array.from(
    new Set(products.map((p) => p.fireworkType).filter((v): v is string => Boolean(v))),
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const filtered = products.filter((p) => {
    const text = [p.partNumber, p.name, p.manufacturer, p.fireworkType]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesManufacturer = !manufacturerFilter || p.manufacturer === manufacturerFilter;
    const matchesType = !typeFilter || p.fireworkType === typeFilter;
    const d = p.durationSeconds;
    const matchesMin = minDuration == null || (d != null && d >= minDuration);
    const matchesMax = maxDuration == null || (d != null && d <= maxDuration);
    return matchesQuery && matchesManufacturer && matchesType && matchesMin && matchesMax;
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
        searchPlaceholder="Search part #, name, manufacturer…"
        filters={[
          {
            key: 'manufacturer',
            label: 'Manufacturer',
            type: 'select',
            options: manufacturerOptions,
          },
          {
            key: 'type',
            label: 'Type',
            type: 'select',
            options: typeOptions,
          },
          {
            key: 'duration',
            label: 'Duration',
            type: 'range',
            unit: 's',
          },
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
            itemLabel="catalogue product"
          />
        }
      >
        <table className={tableClasses('min-w-[960px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses()}>Part</th>
              <th className={tableHeaderCellClasses()}>Product</th>
              <th className={tableHeaderCellClasses()}>Manufacturer</th>
              <th className={tableHeaderCellClasses()}>Type</th>
              <th className={tableHeaderCellClasses()}>Duration</th>
              <th className={tableHeaderCellClasses('text-right')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((product) => (
              <tr key={product.id} className={tableRowClasses()}>
                <td
                  className={tableCellClasses(
                    'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {product.partNumber}
                </td>
                <td className={tableCellClasses()}>
                  <div className="max-w-md truncate font-medium text-[color:var(--color-content-emphasis)]">
                    {product.name}
                  </div>
                  {product.fireworkType ? (
                    <div className="mt-1">
                      <Badge solid tone="neutral">
                        {product.fireworkType}
                      </Badge>
                    </div>
                  ) : null}
                </td>
                <td className={tableCellClasses('text-[color:var(--color-content-subtle)]')}>
                  {product.manufacturer || '—'}
                </td>
                <td className={tableCellClasses('text-[color:var(--color-content-subtle)]')}>
                  {product.fireworkType || '—'}
                </td>
                <td
                  className={tableCellClasses(
                    'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {formatDuration(product.durationSeconds)}
                </td>
                <td className={tableCellClasses('text-right')}>
                  <ProductRowActions
                    product={{
                      id: product.id,
                      partNumber: product.partNumber,
                      name: product.name,
                      manufacturer: product.manufacturer ?? undefined,
                      fireworkType: product.fireworkType ?? undefined,
                      durationSeconds: product.durationSeconds,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
