/** Loading skeleton for the admin effects list. */

import { FilterSkeleton, TableSkeleton } from '@/app/components/app/RouteSkeletons';
import { TABLE_PAGE_SIZE } from '@/app/components/ui/TablePagination';

export default function AdminEffectsLoading() {
  return (
    <div className="space-y-8" aria-label="Loading effects">
      <FilterSkeleton />
      <TableSkeleton rows={TABLE_PAGE_SIZE} columns={9} />
    </div>
  );
}
