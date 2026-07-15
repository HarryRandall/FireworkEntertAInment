/**
 * Segment-level fallback for the /admin subtree.
 *
 * This boundary can render while nested admin pages are changing, so keep it
 * neutral. The exact dashboard page has its own Suspense skeleton for overview
 * tab content once the route itself has loaded.
 */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminSegmentLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6" aria-label="Loading admin page">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  );
}
