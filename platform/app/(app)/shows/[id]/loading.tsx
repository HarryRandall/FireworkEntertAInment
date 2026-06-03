'use client';

/** Loading fallback for show detail routes. */

import { usePathname, useSearchParams } from 'next/navigation';
import { GeneratingShowAnimation } from '@/app/components/app/GeneratingShowAnimation';
import { ListSkeleton } from '@/app/components/app/RouteSkeletons';
import { Skeleton } from '@/app/components/ui/Feedback';

const GENERATING_SPLASH_CLASS = '-mx-6 -my-6 flex-1 sm:-mx-8 lg:-mx-10';

export default function ShowLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const generatingPersistKey = pathname?.match(/\/shows\/([^/]+)\/generating\/?$/)?.[1];

  if (generatingPersistKey) {
    const showTitle = searchParams.get('t')?.trim() || undefined;

    return (
      <GeneratingShowAnimation
        showTitle={showTitle}
        persistKey={generatingPersistKey}
        className={GENERATING_SPLASH_CLASS}
      />
    );
  }

  return (
    <div className="space-y-10" aria-label="Loading show">
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}
