/** Loading skeleton for the admin supplier list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminSuppliersLoading() {
  return (
    <AdminTableRouteSkeleton
      rows={10}
      columns={6}
      filterCount={1}
      hasAction
      ariaLabel="Loading suppliers"
    />
  );
}
