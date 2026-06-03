/** 3D preview tab for a show, rendering the firework replay canvas. */

import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { FireworkReplayViewer } from '@/app/components/app/FireworkReplayViewer';
import { ReplayPanelSkeleton } from '@/app/components/app/RouteSkeletons';
import {
  getAudioSignedUrl,
  getShowBySlug,
  listFireworkProducts,
  listReplayCuesForShow,
} from '@/lib/shows.server';

type PageProps = { params: Promise<{ id: string }> };

export default function ShowPreviewPage(props: PageProps) {
  const { params } = props;

  return (
    <Suspense fallback={<ReplayPanelSkeleton />}>
      <ShowPreviewReplay params={params} />
    </Suspense>
  );
}

async function ShowPreviewReplay(props: PageProps) {
  const { params } = props;
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  if (show.generationStatus === 'running') redirect(`/shows/${show.slug}/generating`);

  const [cues, specifications, audioUrl] = await Promise.all([
    listReplayCuesForShow(show.id),
    listFireworkProducts(),
    getAudioSignedUrl(show.audioPath),
  ]);

  return (
    <FireworkReplayViewer
      showId={show.id}
      showSlug={show.slug}
      showName={show.title}
      durationSeconds={show.durationSeconds}
      totalCents={show.totalCents}
      cues={cues}
      specifications={specifications}
      launchPositions={show.launchPositions}
      audioUrl={audioUrl}
    />
  );
}
