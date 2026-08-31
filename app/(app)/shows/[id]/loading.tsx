'use client';

/** Loading fallback for show detail routes. */

import { usePathname, useSearchParams } from 'next/navigation';
import { GeneratingShowAnimation } from '@/app/components/app/GeneratingShowAnimation';
import { GENERATING_ROUTE_SPLASH_CLASS } from '@/app/components/app/generatingSplashLayout';
import { ShowDetailContentSkeleton } from './ShowDetailContentSkeleton';

export default function ShowLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const generatingPersistKey = pathname?.match(/\/shows\/([^/]+)\/generating\/?$/)?.[1];
  const segment = pathname?.match(/^\/shows\/[^/]+(?:\/([^/]+))?\/?$/)?.[1];

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

  return <ShowDetailContentSkeleton segment={segment} />;
}
