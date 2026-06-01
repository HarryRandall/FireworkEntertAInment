/** Loading skeleton for the admin user list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminUsersLoading() {
  return <AdminTableRouteSkeleton rows={10} columns={5} ariaLabel="Loading admin users" />;
}
