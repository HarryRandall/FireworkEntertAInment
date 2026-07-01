/** Admin multishots page: compositions of fireworks placed on a timeline. */

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
import { listMultishots } from '@/lib/admin.server';
import { formatDuration } from '@/lib/show-domain';
import { NewMultishotButton } from './NewMultishotButton';

type PageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

type MultishotsSearchParams = Awaited<PageProps['searchParams']>;

export default async function AdminMultishotsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <Suspense
        fallback={
          <>
            <FilterSkeleton searchPlaceholder="Search multishot..." actionLabel="New multishot" />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TableSkeleton
                rows={TABLE_PAGE_SIZE}
                headers={['Preview', 'Multishot', 'Shots', 'Duration', 'Open']}
                tableClassName="min-w-[820px]"
              />
            </div>
          </>
        }
      >
        <MultishotsData params={params} />
      </Suspense>
    </div>
  );
}

async function MultishotsData({ params }: { params: MultishotsSearchParams }) {
  const query = (params.q ?? '').trim().toLowerCase();
  const requestedPage = Number(params.page ?? '1');
  const multishots = await listMultishots();

  const filtered = multishots.filter((multishot) => {
    const text = [multishot.name, multishot.slug].filter(Boolean).join(' ').toLowerCase();
    return !query || text.includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

  return (
    <>
      <FilterBar searchPlaceholder="Search multishot…" action={<NewMultishotButton />} />

      <DataTableShell
        viewport
        footer={
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={params}
            visibleItems={paginated.length}
            totalItems={filtered.length}
            itemLabel="multishot"
          />
        }
      >
        <table className={tableClasses('min-w-[820px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses()}>Preview</th>
              <th className={tableHeaderCellClasses()}>Multishot</th>
              <th className={tableHeaderCellClasses()}>Shots</th>
              <th className={tableHeaderCellClasses()}>Duration</th>
              <th className={tableHeaderCellClasses('text-right')}>Open</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((multishot) => (
              <tr key={multishot.id} className={tableRowClasses()}>
                <td className={tableCellClasses()}>
                  <EffectPreviewIcon preview={multishot.preview} />
                </td>
                <td className={tableCellClasses()}>
                  <div className="line-clamp-2 max-w-md font-medium text-[color:var(--color-content-emphasis)]">
                    {multishot.name}
                  </div>
                  <div className="mt-1 font-mono text-xs whitespace-nowrap text-[color:var(--color-content-subtle)] tabular-nums">
                    {multishot.slug}
                  </div>
                </td>
                <td className={tableCellClasses()}>
                  <Badge tone="neutral" solid>
                    {multishot.shotCount} shots
                  </Badge>
                </td>
                <td
                  className={tableCellClasses(
                    'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {formatDuration(multishot.durationSeconds)}
                </td>
                <td className={tableCellClasses('text-right')}>
                  <Link
                    href={`/admin/multishots/${multishot.id}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                    aria-label={`Open ${multishot.name}`}
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
