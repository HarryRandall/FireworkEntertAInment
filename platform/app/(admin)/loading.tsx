/** Loading skeleton for admin routes. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-label="Loading admin data">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  );
}
