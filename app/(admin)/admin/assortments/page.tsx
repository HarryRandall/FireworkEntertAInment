/** Admin assortments list: priced in-store bundles of catalogue items sold to kiosk shoppers. */

import Link from 'next/link';
import { Suspense } from 'react';
import { TableSkeleton } from '@/app/components/app/RouteSkeletons';
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
import { formatBudget } from '@/lib/show-domain';
import { listAssortments } from '@/lib/admin/assortments.server';
import { NewAssortmentButton } from './NewAssortmentButton';

type PageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};
type AssortmentsSearchParams = Awaited<PageProps['searchParams']>;

export default async function AdminAssortmentsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8">
      <FilterBar searchPlaceholder="Search assortments…" action={<NewAssortmentButton />} />
      <Suspense
        fallback={
          <div className="min-h-0 flex-1 overflow-hidden">
            <TableSkeleton
              rows={TABLE_PAGE_SIZE}
              headers={['Assortment', 'Price', 'Items', 'Status', 'Updated']}
            />
          </div>
        }
      >
        <AssortmentsTable params={params} />
      </Suspense>
    </div>
  );
}

async function AssortmentsTable({ params }: { params: AssortmentsSearchParams }) {
  const query = (params.q ?? '').trim().toLowerCase();
  const requestedPage = Number(params.page ?? '1');
  const assortments = await listAssortments();

  const filtered = assortments.filter((assortment) => {
    const text = [assortment.name, assortment.slug].join(' ').toLowerCase();
    return !query || text.includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

  return (
    <DataTableShell
      footer={
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          searchParams={params}
          visibleItems={paginated.length}
          totalItems={filtered.length}
          itemLabel="assortment"
        />
      }
    >
      <table className={tableClasses()}>
        <thead className={tableHeadClasses()}>
          <tr>
            <th className={tableHeaderCellClasses()}>Assortment</th>
            <th className={tableHeaderCellClasses()}>Price</th>
            <th className={tableHeaderCellClasses()}>Items</th>
            <th className={tableHeaderCellClasses()}>Status</th>
            <th className={tableHeaderCellClasses()}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className={tableCellClasses(
                  'text-muted-foreground py-12 text-center text-sm font-normal',
                )}
              >
                {query
                  ? 'No assortments match that search.'
                  : 'No assortments have been created yet.'}
              </td>
            </tr>
          ) : null}
          {paginated.map((assortment) => (
            <tr key={assortment.id} className={tableRowClasses('group')}>
              <td className={tableCellClasses('p-0')}>
                <Link
                  href={`/admin/assortments/${assortment.id}`}
                  className="block px-4 py-3 text-sm font-medium text-[color:var(--color-content-emphasis)] hover:underline"
                >
                  {assortment.name}
                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                    {assortment.slug}
                  </span>
                </Link>
              </td>
              <td className={tableCellClasses('font-mono text-sm tabular-nums')}>
                {formatBudget(assortment.priceCents)}
              </td>
              <td className={tableCellClasses('text-sm tabular-nums')}>{assortment.itemCount}</td>
              <td className={tableCellClasses()}>
                <Badge tone={assortment.isActive ? 'success' : 'neutral'}>
                  {assortment.isActive ? 'Active' : 'Draft'}
                </Badge>
              </td>
              <td className={tableCellClasses('text-muted-foreground text-xs')}>
                {new Date(assortment.updatedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
