'use client';

/**
 * Instant splash shown the moment Generate is clicked, covering the content
 * area (the sidebar and app chrome stay put) until the `/generating` route
 * streams in. It shares the session-persisted cover and progress key with the
 * route splash, so the backdrop and bar carry over without any visible reload.
 */

import { GeneratingShowAnimation } from '@/app/components/app/GeneratingShowAnimation';

export function LaunchOverlay({
  slug,
  title,
  hasAudio,
}: {
  slug: string;
  title: string;
  hasAudio: boolean;
}) {
  return (
    // While launching, the wizard form extends to the true bottom edge of the
    // content area (it cancels all of the app main's bottom padding, exactly
    // like the /generating route splash), so the overlay simply fills it. It
    // must stay inside the form's box: the wizard screen is overflow-hidden,
    // so anything extending past it would be clipped.
    <div className="absolute inset-0 z-40">
      {/* Long poll interval: the animation's router.refresh() polling is for the
          generating route; while this overlay briefly covers the wizard there is
          nothing to poll. */}
      <GeneratingShowAnimation
        showTitle={title}
        persistKey={slug}
        hasAudio={hasAudio}
        phase={hasAudio ? 'analysing' : 'generating'}
        randomiseCoverOnLoad
        pollIntervalMs={60_000}
        className="h-full"
      />
    </div>
  );
}
