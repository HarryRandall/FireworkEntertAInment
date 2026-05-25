/** Loading skeleton for the show detail route. */

import { ListSkeleton } from '@/app/components/app/RouteSkeletons';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function ShowLoading() {
  return (
    <div className="space-y-10" aria-label="Loading show">
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}
