/** Group-level loading fallback for retailer-admin routes; deliberately neutral so it can't flash the wrong page shape mid-navigation. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function RetailerAdminLoading() {
  return (
    <div className="space-y-6" aria-label="Loading retailer admin data">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  );
}
