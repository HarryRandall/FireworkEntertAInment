/** Loading skeleton for the admin catalogue list. */

import { FilterSkeleton, TableSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminCatalogueLoading() {
  return (
    <div className="space-y-8" aria-label="Loading catalogue">
      <FilterSkeleton />
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}
