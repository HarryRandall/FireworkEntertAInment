/** Loading skeleton for the admin fireworks list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';
import { TABLE_PAGE_SIZE } from '@/app/components/ui/TablePagination';

export default function AdminFireworksLoading() {
  return (
    <AdminTableRouteSkeleton
      rows={TABLE_PAGE_SIZE}
      columns={9}
      filterCount={3}
      ariaLabel="Loading fireworks"
    />
  );
}
