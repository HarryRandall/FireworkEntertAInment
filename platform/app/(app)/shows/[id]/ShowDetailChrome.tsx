'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { Button } from '@/app/components/ui/Button';
import { ShowTabs } from './ShowTabs';
import { getShowDetailSection } from './show-detail-sections';

type ShowDetailChromeProps = {
  children: ReactNode;
  forceContentOnly?: boolean;
  showSlug: string;
  showTitle: string;
};

export function ShowDetailChrome({
  children,
  forceContentOnly = false,
  showSlug,
  showTitle,
}: ShowDetailChromeProps) {
  const segment = useSelectedLayoutSegment();
  const section = getShowDetailSection(segment);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const routeKey = `${showSlug}:${segment ?? section.segment}:${forceContentOnly ? 'content-only' : 'chrome'}`;
  const previousRouteKeyRef = useRef(routeKey);

  useEffect(() => {
    // The layout stays mounted between show sections. Move focus after a real
    // route change without stealing it during the initial hydration.
    if (previousRouteKeyRef.current === routeKey) return;
    previousRouteKeyRef.current = routeKey;
    headingRef.current?.focus({ preventScroll: true });
  }, [routeKey]);

  if (forceContentOnly || segment === 'generating') {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {showTitle}
      </h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ShowTabs id={showSlug} />
        <div className="flex items-center gap-2">
          <Button
            href={`/shows/${showSlug}/preview?cueDialog=ai`}
            prefetch={false}
            variant="secondary"
            size="sm"
          >
            Refine
          </Button>
          <Button href={`/api/shows/${showSlug}/export`} prefetch={false} size="sm">
            Export
          </Button>
        </div>
      </div>

      {children}
    </div>
  );
}
