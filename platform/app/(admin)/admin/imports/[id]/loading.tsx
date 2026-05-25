/** Loading skeleton for the admin import detail route. */

import { ReplayPanelSkeleton, ListSkeleton } from '@/app/components/app/RouteSkeletons';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminImportDetailLoading() {
  return (
    <div className="space-y-6" aria-label="Loading import detail">
      <Skeleton className="h-20 rounded-xl" />
      <ReplayPanelSkeleton />
      <ListSkeleton rows={4} />
    </div>
  );
}
