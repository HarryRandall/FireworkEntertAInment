/** Admin supplier list page with create / edit dialogs. */

import { Suspense } from 'react';
import { TableSkeleton } from '@/app/components/app/RouteSkeletons';
import { FilterBar } from '@/app/components/ui/FilterBar';
import { TABLE_PAGE_SIZE, TablePagination } from '@/app/components/ui/TablePagination';
import {
  DataTableShell,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
} from '@/app/components/ui/DataTable';
import { listSuppliers } from '@/lib/admin.server';
import { SupplierFormDialog } from './SupplierFormDialog';
import { SuppliersTableBody } from './SuppliersTableBody';

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
};
type SuppliersSearchParams = Awaited<PageProps['searchParams']>;

export default async function AdminSuppliersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <div className="flex justify-end">
        <SupplierFormDialog />
      </div>

      <FilterBar
        searchPlaceholder="Search name, email, phone, website…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'archived', label: 'Archived' },
            ],
          },
        ]}
      />

      <Suspense
        fallback={
          <div className="min-h-0 flex-1 overflow-hidden">
            <TableSkeleton
              rows={TABLE_PAGE_SIZE}
              headers={['Name', 'Email', 'Phone', 'Website', 'Status', 'Actions']}
              rowSize="relaxed"
            />
          </div>
        }
      >
        <SuppliersTable params={params} />
      </Suspense>
    </div>
  );
}

async function SuppliersTable({ params }: { params: SuppliersSearchParams }) {
  const query = (params.q ?? '').trim().toLowerCase();
  const statusFilter = params.status;
  const requestedPage = Number(params.page ?? '1');

  const suppliers = await listSuppliers();
  const filtered = suppliers.filter((s) => {
    const text = [s.name, s.contactEmail, s.phone, s.websiteUrl]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesStatus = !statusFilter || s.status === statusFilter;
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
      <DataTableShell
        viewport
        footer={
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={params}
            visibleItems={paginated.length}
            totalItems={filtered.length}
            itemLabel="supplier"
          />
        }
      >
        <table className={tableClasses()}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses()}>Name</th>
              <th className={tableHeaderCellClasses()}>Email</th>
              <th className={tableHeaderCellClasses()}>Phone</th>
              <th className={tableHeaderCellClasses()}>Website</th>
              <th className={tableHeaderCellClasses()}>Status</th>
              <th className={tableHeaderCellClasses('text-right')}>Actions</th>
            </tr>
          </thead>
          <SuppliersTableBody suppliers={paginated} />
        </table>
      </DataTableShell>
    </>
  );
}
