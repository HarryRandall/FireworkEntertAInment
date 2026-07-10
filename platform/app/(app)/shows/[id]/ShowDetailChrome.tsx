'use client';

import type { ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { Button } from '@/app/components/ui/Button';
import { ShowTabs } from './ShowTabs';

type ShowDetailChromeProps = {
  children: ReactNode;
  forceContentOnly?: boolean;
  showSlug: string;
};

export function ShowDetailChrome({
  children,
  forceContentOnly = false,
  showSlug,
}: ShowDetailChromeProps) {
  const segment = useSelectedLayoutSegment();

  if (forceContentOnly || segment === 'generating') {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
  }

  return (
    <div className="space-y-6">
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
