/** 3D preview tab for a show, rendering the firework replay canvas. */

import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { FireworkReplayViewer } from '@/ui/replay/FireworkReplayViewer';
import { getCurrentProfile } from '@/lib/access/current-profile.server';
import { parseGenerationHandover } from '@/lib/generation-handover';
import { getAudioSignedUrl } from '@/lib/shows/audio.server';
import {
  getShowBySlug,
  listFireworkProducts,
  getReplayCuePayloadForShow,
} from '@/lib/shows/queries.server';
import ShowPreviewLoading from './loading';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ handover?: string; t?: string; a?: string }>;
};

export default function ShowPreviewPage(props: PageProps) {
  const { params, searchParams } = props;

  // The route loading state doubles as the streaming fallback: it reads the
  // URL itself, so arriving from the generating route keeps that splash up
  // while this page streams instead of dropping to the replay skeleton.
  return (
    <Suspense fallback={<ShowPreviewLoading />}>
      <ShowPreviewReplay params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ShowPreviewReplay(props: PageProps) {
  const { params, searchParams } = props;
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  if (show.generationStatus === 'running') redirect(`/shows/${show.slug}/generating`);
  const currentProfilePromise = getCurrentProfile();
  const handover = parseGenerationHandover(await searchParams);

  // Stream the replay data into the client viewer as promises rather than
  // awaiting it here. The cues are the payload the user is waiting on, so they
  // stream on their own and populate the timeline the moment they land; the
  // much heavier full catalogue (only needed for the add-firework dialog) and
  // the signed audio URL each stream independently so neither gates fireworks
  // or delays the other.
  // The show row itself is awaited so notFound/redirect still run on the
  // server before anything renders.
  const replayCuesPromise = getReplayCuePayloadForShow(show.id);
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
      generationHandover={
        handover
          ? {
              title: handover.title ?? show.title,
              hasAudio: handover.hasAudio || Boolean(show.audioPath || show.musicAnalysisId),
              cover: show.coverShader,
            }
          : null
      }
    />
  );
}
