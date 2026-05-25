/** Loading skeleton for the `/dashboard` route. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function DashboardLoading() {
  return (
    <div className="space-y-12" aria-label="Loading dashboard">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
