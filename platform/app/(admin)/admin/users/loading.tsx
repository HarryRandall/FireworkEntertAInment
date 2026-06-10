/** Loading skeleton for the admin user list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminUsersLoading() {
  return (
    <AdminTableRouteSkeleton
      searchPlaceholder="Search name, email, phone..."
      headers={['User', 'Role', 'Status', 'Updated', 'Actions']}
      rows={8}
      ariaLabel="Loading admin users"
    />
  );
}
