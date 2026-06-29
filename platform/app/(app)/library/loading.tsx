/** Loading skeleton for the `/library` route. */

import { LibraryCardsSkeleton } from '@/app/components/app/RouteSkeletons';

export default function LibraryLoading() {
  return (
    <div className="space-y-2" aria-label="Loading show library">
      <LibraryCardsSkeleton />
    </div>
  );
}
