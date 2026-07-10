'use client';

/** Loading fallback for show detail routes. */

import { usePathname, useSearchParams } from 'next/navigation';
import { GeneratingShowAnimation } from '@/app/components/app/GeneratingShowAnimation';
import { GENERATING_ROUTE_SPLASH_CLASS } from '@/app/components/app/generatingSplashLayout';
import { ListSkeleton } from '@/app/components/app/RouteSkeletons';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function ShowLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const generatingPersistKey = pathname?.match(/\/shows\/([^/]+)\/generating\/?$/)?.[1];

  if (generatingPersistKey) {
    const showTitle = searchParams.get('t')?.trim() || undefined;
    const hasAudio = searchParams.get('a') === '1';

    return (
      <GeneratingShowAnimation
        showTitle={showTitle}
        hasAudio={hasAudio}
        phase={hasAudio ? 'analysing' : 'generating'}
        persistKey={generatingPersistKey}
        className={GENERATING_ROUTE_SPLASH_CLASS}
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
