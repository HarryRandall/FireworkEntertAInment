/** Loading skeleton for the `/shows` route. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function ShowsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6" aria-label="Loading shows">
      <header className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </header>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="border-border border-b px-4 py-3 last:border-b-0">
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
