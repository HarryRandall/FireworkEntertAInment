/** Show-guide tab listing each cue with launch instructions for the operator. */

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ShowGuideList } from '@/app/components/app/ShowGuideList';
import { ListSkeleton } from '@/app/components/app/RouteSkeletons';
import { getShowBySlug, listCuesForShow } from '@/lib/shows.server';
import type { Show } from '@/lib/show-domain';

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowGuidePage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();

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
