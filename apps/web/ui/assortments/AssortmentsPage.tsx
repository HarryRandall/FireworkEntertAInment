import Link from 'next/link';
import { Suspense } from 'react';
import { TableSkeleton } from '@/ui/shell/RouteSkeletons';
import { Badge } from '@/ui/patterns/Badge';
import { FilterBar } from '@/ui/patterns/FilterBar';
import { TABLE_PAGE_SIZE, TablePagination } from '@/ui/patterns/TablePagination';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/ui/patterns/DataTable';
import { formatBudget } from '@/lib/show-domain';
import { listAssortments } from '@/lib/admin/assortments.server';
import { NewAssortmentButton } from './NewAssortmentButton';
import { SectionHeader } from '@/ui/patterns/SectionHeader';

type PageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
  destination: '/admin/assortments' | '/my-store/assortments';
};
type AssortmentsSearchParams = Awaited<PageProps['searchParams']>;

export async function AssortmentsPage({ searchParams, destination }: PageProps) {
  const params = await searchParams;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Assortments"
        description="Build your product packs, set their price and share a reusable QR code."
        action={<NewAssortmentButton destination={destination} />}
      />
      <FilterBar searchPlaceholder="Search assortments…" />
      <Suspense
        key={`${params.q ?? ''}:${params.page ?? '1'}`}
        fallback={
          <div className="min-h-0 flex-1 overflow-hidden">
            <TableSkeleton
              rows={TABLE_PAGE_SIZE}
              headers={['Assortment', 'Price', 'Items', 'Status', 'Updated']}
            />
          </div>
        }
      >
        <AssortmentsTable params={params} destination={destination} />
      </Suspense>
    </div>
  );
}

async function AssortmentsTable({
  params,
  destination,
}: {
  params: AssortmentsSearchParams;
  destination: PageProps['destination'];
}) {
  const query = (params.q ?? '').trim().toLowerCase();
  const requestedPage = Number(params.page ?? '1');
  const assortments = await listAssortments();

  const filtered = assortments.filter((assortment) => {
    const text = [assortment.name, assortment.slug].join(' ').toLowerCase();
    return !query || text.includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, Math.floor(requestedPage)), totalPages)
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
        <caption className="sr-only">Assortments, pricing and availability</caption>
        <thead className={tableHeadClasses()}>
          <tr>
            <th scope="col" className={tableHeaderCellClasses()}>
              Assortment
            </th>
            <th scope="col" className={tableHeaderCellClasses()}>
              Price
            </th>
            <th scope="col" className={tableHeaderCellClasses()}>
              Items
            </th>
            <th scope="col" className={tableHeaderCellClasses()}>
              Status
            </th>
            <th scope="col" className={tableHeaderCellClasses()}>
              Updated
            </th>
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
                  href={`${destination}/${assortment.id}`}
                  className="text-foreground block px-4 py-3 text-sm font-medium hover:underline"
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
                <Badge solid tone={assortment.isActive ? 'success' : 'neutral'}>
                  {assortment.isActive ? 'Active' : 'Draft'}
                </Badge>
              </td>
              <td className={tableCellClasses('text-muted-foreground text-xs')}>
                <time dateTime={assortment.updatedAt}>
                  {new Date(assortment.updatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
