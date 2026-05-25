/** Loading skeleton for the admin user detail route. */

import { ListSkeleton } from '@/app/components/app/RouteSkeletons';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminUserDetailLoading() {
  return (
    <div className="space-y-8" aria-label="Loading user detail">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-20 rounded-xl" />
      <ListSkeleton rows={6} />
    </div>
  );
}
