/** Loading skeleton for the admin effects list. */

import { FilterSkeleton, TableSkeleton } from '@/app/components/app/RouteSkeletons';
export default function AdminEffectsLoading() {
  return (
    <div className="space-y-8" aria-label="Loading effects">
      <FilterSkeleton />
      <TableSkeleton rows={12} columns={8} />
    </div>
  );
}
