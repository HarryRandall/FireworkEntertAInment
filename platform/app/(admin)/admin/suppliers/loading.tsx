/** Loading skeleton for the admin supplier list. */

import { FilterSkeleton, TableSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminSuppliersLoading() {
  return (
    <div className="space-y-8" aria-label="Loading suppliers">
      <FilterSkeleton />
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}
