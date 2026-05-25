/** Loading skeleton shared by marketing routes. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function MarketingLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-12" aria-label="Loading page">
      <Skeleton className="h-12 w-72 max-w-full" />
      <Skeleton className="h-5 w-[36rem] max-w-full" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
