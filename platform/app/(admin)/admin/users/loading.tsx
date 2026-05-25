/** Loading skeleton for the admin user list. */

import { FilterSkeleton, TableSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminUsersLoading() {
  return (
    <div className="space-y-8" aria-label="Loading admin users">
      <FilterSkeleton />
      <TableSkeleton rows={10} columns={5} />
    </div>
  );
}
