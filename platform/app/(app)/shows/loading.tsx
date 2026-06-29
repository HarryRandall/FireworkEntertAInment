/** Loading skeleton for the `/shows` route. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function ShowsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5" aria-label="Loading shows">
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-11 w-full rounded-full sm:w-32" />
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Skeleton className="h-11 min-w-0 rounded-xl" />
          <Skeleton className="h-11 rounded-xl sm:w-36" />
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="min-w-0">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <div className="mt-2.5 space-y-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
