/** Loading skeleton for the `/library` route. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function LibraryLoading() {
  return (
    <div className="space-y-8" aria-label="Loading show library">
      <div className="border-outline-variant/55 min-h-[136px] space-y-3 border-b pb-6">
        <Skeleton className="mt-8 h-10 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-48 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="border-outline-variant/45 bg-surface-container-low/80 overflow-hidden rounded-xl border"
          >
            <Skeleton className="h-52 rounded-none" />
            <div className="space-y-4 p-5">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
