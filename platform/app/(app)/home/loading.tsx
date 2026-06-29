/** Loading skeleton for the redesigned `/home` route. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function HomeLoading() {
  return (
    <div className="flex flex-col gap-7" aria-label="Loading home activity">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="min-h-[14rem] rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="w-40 shrink-0 space-y-2 sm:w-48">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="w-44 shrink-0 space-y-2 sm:w-48">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-10 rounded-md" />
              </div>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
