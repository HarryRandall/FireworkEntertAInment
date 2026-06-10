/** Loading skeleton for the redesigned `/dashboard` route. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7" aria-label="Loading dashboard">
      <div className="border-border bg-card rounded-xl border p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-3 rounded-full" />
          </div>
        </div>
        <Skeleton className="mt-6 h-12 w-full rounded-md" />
        <div className="mt-5 flex flex-wrap justify-between gap-4">
          <Skeleton className="h-5 w-72 max-w-full" />
          <Skeleton className="h-8 w-48 rounded-md" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="border-border border-b px-4 py-3 last:border-b-0">
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
