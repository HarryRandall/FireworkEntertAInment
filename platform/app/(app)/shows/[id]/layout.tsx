/** Show detail layout; loads the show by slug and renders the per-show tab navigation. */

import type { ReactNode } from 'react';
import { Button } from '@/app/components/ui/Button';
import { ShowTabs } from './ShowTabs';
import { getShowBySlug } from '@/lib/shows.server';

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export const maxDuration = 300;

export default async function ShowLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
  }

  // While the show is still being generated, hide the metadata row, the
  // Refine/Export actions, and the tab nav, those controls point at pages
  // that have no data yet. The splash rendered by the /generating route
  // takes over the space instead.
  const isGenerating = show.generationStatus === 'running';

  if (isGenerating) {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ShowTabs id={show.slug} />
        <div className="flex items-center gap-2">
          <Button
            href={`/shows/${show.slug}/preview?cueDialog=ai`}
            prefetch={false}
            variant="secondary"
            size="sm"
          >
            Refine
          </Button>
          <Button href={`/api/shows/${show.slug}/export`} prefetch={false} size="sm">
            Export
          </Button>
        </div>
      </div>

      {children}
    </div>
  );
}
