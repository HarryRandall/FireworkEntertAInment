/** Admin catalogue page listing every firework product available across suppliers. */

import { Suspense } from 'react';
import { CircleDashed, CircleDot, Layers3, Package, type LucideIcon } from 'lucide-react';
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
import {
  formatDuration,
  formatManufacturerLabel,
  MANUFACTURER_FILTER_NONE,
  matchesManufacturerFilter,
} from '@/lib/show-domain';
import { listCatalogueProducts } from '@/lib/admin.server';
import { ProductRowActions } from './ProductRowActions';

const KIND_LABELS: Record<string, string> = {
  firework: 'Firework',
  multishot: 'Multishot',
  bundle: 'Bundle',
  other: 'Other',
};

const KIND_ICONS: Record<string, LucideIcon> = {
  firework: CircleDashed,
  multishot: Layers3,
  bundle: Package,
  other: CircleDot,
};

function kindIcon(kind: string): LucideIcon {
  return KIND_ICONS[kind] ?? CircleDot;
}

type PageProps = {
  searchParams: Promise<{
    q?: string;
    manufacturer?: string;
    kind?: string;
    duration_min?: string;
    duration_max?: string;
    page?: string;
  }>;
};
type CatalogueSearchParams = Awaited<PageProps['searchParams']>;

export default async function AdminCataloguePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8">
      <Suspense
        fallback={
          <>
            <FilterSkeleton searchPlaceholder="Search part #, name, manufacturer..." />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TableSkeleton
                rows={TABLE_PAGE_SIZE}
                headers={['Part', 'Item', 'Kind', 'Manufacturer', 'Duration', 'Actions']}
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
  const kindFilter = params.kind;
  const minDuration = params.duration_min ? Number(params.duration_min) : null;
  const maxDuration = params.duration_max ? Number(params.duration_max) : null;
  const requestedPage = Number(params.page ?? '1');

  const products = await listCatalogueProducts();

  const manufacturerOptions = Array.from(
    new Set(products.map((p) => p.manufacturer).filter((v): v is string => Boolean(v))),
  )
    .sort()
    .map((v) => ({ value: v, label: v }));
  if (products.some((p) => p.manufacturer == null)) {
    manufacturerOptions.push({ value: MANUFACTURER_FILTER_NONE, label: 'Digitally created' });
  }

  const kindOptions = Array.from(new Set(products.map((p) => p.kind).filter(Boolean)))
    .sort()
    .map((v) => ({ value: v, label: KIND_LABELS[v] ?? v }));

  const filtered = products.filter((p) => {
    const text = [p.partNumber, p.name, p.manufacturer, p.fireworkType, p.kind]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesManufacturer = matchesManufacturerFilter(p.manufacturer, manufacturerFilter ?? '');
    const matchesKind = !kindFilter || p.kind === kindFilter;
    const d = p.durationSeconds;
    const matchesMin = minDuration == null || (d != null && d >= minDuration);
    const matchesMax = maxDuration == null || (d != null && d <= maxDuration);
    return matchesQuery && matchesManufacturer && matchesKind && matchesMin && matchesMax;
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
            key: 'kind',
            label: 'Kind',
            type: 'select',
            options: kindOptions,
          },
          {
            key: 'manufacturer',
            label: 'Manufacturer',
            type: 'select',
            options: manufacturerOptions,
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
              <th className={tableHeaderCellClasses()}>Item</th>
              <th className={tableHeaderCellClasses()}>Kind</th>
              <th className={tableHeaderCellClasses()}>Manufacturer</th>
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
                    <div className="mt-1 text-xs text-[color:var(--color-content-subtle)]">
                      {product.fireworkType}
                    </div>
                  ) : null}
                </td>
                <td className={tableCellClasses()}>
                  <Badge solid tone="neutral" icon={kindIcon(product.kind)}>
                    {KIND_LABELS[product.kind] ?? product.kind}
                  </Badge>
                </td>
                <td className={tableCellClasses('text-[color:var(--color-content-subtle)]')}>
                  {formatManufacturerLabel(product.manufacturer)}
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
