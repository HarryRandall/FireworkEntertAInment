/** Loading skeleton for the admin catalogue list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminCatalogueLoading() {
  return (
    <AdminTableRouteSkeleton
      rows={10}
      columns={6}
      filterCount={3}
      hasAction
      ariaLabel="Loading catalogue"
    />
  );
}
