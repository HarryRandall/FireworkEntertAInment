/** Loading skeleton for the admin supplier list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminSuppliersLoading() {
  return (
    <AdminTableRouteSkeleton
      title="Suppliers"
      description="Manage supplier records, contacts, and status."
      searchPlaceholder="Search name, email, phone, website..."
      headers={['Name', 'Email', 'Phone', 'Website', 'Status', 'Actions']}
      rows={10}
      hasAction
      ariaLabel="Loading suppliers"
    />
  );
}
