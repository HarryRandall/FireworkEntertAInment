'use client';

/** Shared show page chrome and route-aware tab navigation. */

import { useEffect, useRef, type ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { Button } from '@/ui/patterns/Button';
import { ShowExportButton } from '@/ui/shows/ShowExportButton';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/tabs';
import { SectionHeader } from '@/ui/patterns/SectionHeader';
import { SHOW_DETAIL_SECTIONS } from '../show-detail-sections';
import { getShowDetailSection } from '@/app/(app)/shows/[id]/show-detail-sections';
import { OPEN_SHOW_REFINEMENT_EVENT } from '@/lib/show-detail-events';

type ShowDetailChromeProps = {
  children: ReactNode;
  forceContentOnly?: boolean;
  showSlug: string;
  showTitle: string;
};

/** Shared full-width heading and registry navigation for every show section. */
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
    <div className="mx-auto w-full min-w-0 space-y-4">
      <SectionHeader
        as="h1"
        headingRef={headingRef}
        title={showTitle}
        className="[&_h1]:break-words"
        action={
          <div className="flex items-center gap-2">
            {segment === 'preview' ? (
              <Button
                type="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_SHOW_REFINEMENT_EVENT))}
                variant="secondary"
                size="sm"
              >
                Refine
              </Button>
            ) : (
              <Button
                href={`/shows/${showSlug}/preview?cueDialog=ai`}
                prefetch={false}
                variant="secondary"
                size="sm"
              >
                Refine
              </Button>
            )}
            <ShowExportButton showSlug={showSlug} />
          </div>
        }
      />
      <Tabs value={section.segment} activationMode="manual" className="min-w-0 gap-4">
        <div className="border-border min-w-0 overflow-x-auto border-b pb-1">
          <TabsList variant="line" aria-label="Show sections">
            {SHOW_DETAIL_SECTIONS.map((item) => (
              <TabsTrigger
                key={item.segment}
                value={item.segment}
                className="data-[state=active]:text-foreground data-[state=active]:after:opacity-100"
                asChild
              >
                <Link
                  href={`/shows/${showSlug}/${item.segment}`}
                  prefetch={false}
                  aria-current={section.segment === item.segment ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value={section.segment} className="min-w-0">
          {children}
        </TabsContent>
      </Tabs>
    </div>
  );
}
