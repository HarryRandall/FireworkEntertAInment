/** 3D preview tab for a show, rendering the firework replay canvas. */

import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { FireworkReplayViewer } from '@/components/replay/FireworkReplayViewer';
import { ReplayPanelSkeleton } from '@/components/shell/RouteSkeletons';
import { getCurrentProfile } from '@/lib/admin/current-user.server';
import {
  getAudioSignedUrl,
  getShowBySlug,
  listFireworkProducts,
  listReplayCuesForShow,
} from '@/lib/shows.server';

type PageProps = {
  params: Promise<{ id: string }>;
};

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

  // Stream the replay data into the client viewer as promises rather than
  // awaiting it here. The cues are the payload the user is waiting on, so they
  // stream on their own and populate the timeline the moment they land; the
  // much heavier full catalogue (only needed for the add-firework dialog) and
  // the signed audio URL each stream independently so neither gates fireworks
  // or delays the other.
  // The show row itself is awaited so notFound/redirect still run on the
  // server before anything renders.
  const replayCuesPromise = listReplayCuesForShow(show.id);
  const fireworkSpecificationsPromise = listFireworkProducts();
  const audioUrlPromise = getAudioSignedUrl(show.audioPath);
  const currentProfile = await currentProfilePromise;
  const canEditFireworks = currentProfile?.permissions.includes('admin.manage_catalogue') ?? false;

  return (
    <FireworkReplayViewer
      showId={show.id}
      showSlug={show.slug}
      showName={show.title}
      hasSoundtrack={Boolean(show.audioPath)}
      durationSeconds={show.durationSeconds}
      totalCents={show.totalCents}
      launchPositions={show.launchPositions}
      canEditFireworks={canEditFireworks}
      replayCuesPromise={replayCuesPromise}
      fireworkSpecificationsPromise={fireworkSpecificationsPromise}
      audioUrlPromise={audioUrlPromise}
    />
  );
}
