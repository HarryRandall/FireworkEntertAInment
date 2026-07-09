'use client';

/** Loading skeleton for the show preview tab. */

import { usePathname, useSearchParams } from 'next/navigation';
import { GenerationHandoffSplash } from '@/app/components/app/GenerationHandoffSplash';
import { ReplayPanelSkeleton } from '@/app/components/app/RouteSkeletons';

export default function ShowPreviewLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handoffMatch = pathname?.match(/^\/shows\/([^/]+)\/preview\/?$/);
  if (handoffMatch && searchParams.get('handoff') === '1') {
    return (
      <GenerationHandoffSplash
        title={searchParams.get('t')?.trim() || undefined}
        persistKey={decodeURIComponent(handoffMatch[1] ?? '')}
        hasAudio={searchParams.get('a') === '1'}
      />
    );
  }
  return <ReplayPanelSkeleton />;
}
