/** Loading skeleton for the admin imports list. */

import { ListSkeleton } from '@/app/components/app/RouteSkeletons';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminImportsLoading() {
  return (
    <div className="space-y-6" aria-label="Loading imports">
      <Skeleton className="h-44 rounded-xl" />
      <ListSkeleton rows={6} />
    </div>
  );
}
