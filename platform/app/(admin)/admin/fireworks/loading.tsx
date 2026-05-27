/** Loading skeleton for the admin fireworks list. */

import { FilterSkeleton, TableSkeleton } from '@/app/components/app/RouteSkeletons';
import { TABLE_PAGE_SIZE } from '@/app/components/ui/TablePagination';

export default function AdminFireworksLoading() {
  return (
    <div className="space-y-8" aria-label="Loading fireworks">
      <FilterSkeleton />
      <TableSkeleton rows={TABLE_PAGE_SIZE} columns={8} />
    </div>
  );
}
