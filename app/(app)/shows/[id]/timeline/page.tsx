/** Song context tab exposing the analyser output used for show planning. */

import { notFound, redirect } from 'next/navigation';
import { AudioAnalysisTimeline } from '@/app/components/app/AudioAnalysisTimeline';
import { getLatestAnalysisForShow } from '@/lib/show-analyses.server';
import { getSoundtrackAttribution } from '@/lib/shows/audio.server';
import { getShowBySlug } from '@/lib/shows.server';

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowSongContextPage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  if (show.generationStatus === 'running') redirect(`/shows/${show.slug}/generating`);
  const [latestAnalysis, soundtrackAttribution] = await Promise.all([
    getLatestAnalysisForShow(show.id),
    getSoundtrackAttribution(show.musicAnalysisId),
  ]);

  return (
    <AudioAnalysisTimeline
      hasAudio={Boolean(show.audioPath)}
      initialAnalysis={latestAnalysis}
      soundtrackAttribution={soundtrackAttribution}
    />
  );
}
