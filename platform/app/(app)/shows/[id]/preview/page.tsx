/** 3D preview tab for a show, rendering the firework replay canvas. */

import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { FireworkReplayViewer } from '@/app/components/app/FireworkReplayViewer';
import { ReplayPanelSkeleton } from '@/app/components/app/RouteSkeletons';
import { getCurrentProfile } from '@/lib/admin/current-user.server';
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
  const currentProfilePromise = getCurrentProfile();

  // Stream the heavy replay data (cues, catalogue, audio URL) into the client
  // viewer as a promise rather than awaiting it here. The viewer mounts the 3D
  // canvas immediately with no fireworks, shows a loading bar while this
  // resolves, and only reveals the timeline slider once the data has landed and
  // the engine is ready. The show row itself is awaited so notFound/redirect
  // still run on the server before anything renders.
  const replayDataPromise = Promise.all([
    listReplayCuesForShow(show.id),
    listFireworkProducts(),
    getAudioSignedUrl(show.audioPath),
  ]).then(([cues, specifications, audioUrl]) => ({ cues, specifications, audioUrl }));
  const currentProfile = await currentProfilePromise;
  const canEditFireworks = currentProfile?.permissions.includes('admin.manage_catalogue') ?? false;

  return (
    <FireworkReplayViewer
      showId={show.id}
      showSlug={show.slug}
      showName={show.title}
      durationSeconds={show.durationSeconds}
      totalCents={show.totalCents}
      launchPositions={show.launchPositions}
      canEditFireworks={canEditFireworks}
      replayDataPromise={replayDataPromise}
    />
  );
}
