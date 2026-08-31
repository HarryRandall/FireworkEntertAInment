/** Loading skeleton for the admin supplier list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminSuppliersLoading() {
  return (
    <AdminTableRouteSkeleton
      searchPlaceholder="Search name, email, phone, website..."
      headers={['Name', 'Email', 'Phone', 'Website', 'Status', 'Actions']}
      rowSize="relaxed"
      rows={8}
      filterActionLabel="New supplier"
      ariaLabel="Loading suppliers"
    />
  );
}
