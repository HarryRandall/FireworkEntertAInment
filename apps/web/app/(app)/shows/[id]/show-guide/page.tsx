/** Show-guide tab listing each cue with launch instructions for the operator. */

import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ShowGuideList } from '@/components/shows/ShowGuideList';
import { ListSkeleton } from '@/components/shell/RouteSkeletons';
import { getShowBySlug, listCuesForShow } from '@/lib/shows.server';
import type { Show } from '@/lib/show-domain';

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowGuidePage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  if (show.generationStatus === 'running') redirect(`/shows/${show.slug}/generating`);

  return (
    <div className="max-w-3xl">
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <ShowGuide show={show} />
      </Suspense>
    </div>
  );
}

async function ShowGuide({ show }: { show: Show }) {
  const cues = await listCuesForShow(show.id);
  return <ShowGuideList steps={cues} />;
}
