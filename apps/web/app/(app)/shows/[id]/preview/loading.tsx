'use client';

/** Loading skeleton for the show preview tab. */

import { usePathname, useSearchParams } from 'next/navigation';
import { parseGenerationHandover } from '@/lib/generation-handover';
import { ReplayPanelSkeleton } from '@/ui/shell/RouteSkeletons';
import { GenerationHandoverSplash } from '@/ui/shows/GenerationHandoverSplash';

export default function ShowPreviewLoading() {
  const pathname = usePathname();
  const handover = parseGenerationHandover(useSearchParams());
  const slug = pathname?.match(/\/shows\/([^/]+)\/preview\/?$/)?.[1];

  // Arriving from the generating route: the splash carries on, in its
  // finalising phase, rather than dropping to the skeleton mid-handover.
  if (handover && slug) {
    return (
      <GenerationHandoverSplash
        persistKey={slug}
        title={handover.title}
        hasAudio={handover.hasAudio}
      />
    );
  }

  return <ReplayPanelSkeleton />;
}
