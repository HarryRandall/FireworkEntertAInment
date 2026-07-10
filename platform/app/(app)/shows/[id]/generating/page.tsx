/** Interstitial route rendered while the cue-generation pipeline runs for a newly-created show. */

import { notFound, redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { GeneratingShowAnimation } from '@/app/components/app/GeneratingShowAnimation';
import { GENERATING_ROUTE_SPLASH_CLASS } from '@/app/components/app/generatingSplashLayout';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { getAnalyserWarmthState } from '@/lib/analyser-warmth.server';
import { getMusicAnalysisStatus } from '@/lib/show-analyses.server';
import { getShowBySlug } from '@/lib/shows.server';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creating?: string; t?: string; a?: string }>;
};

export default async function ShowGeneratingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { creating, t, a } = await searchParams;
  // Soundtrack flag forwarded by the wizard so the provisional splash renders
  // the same stage list (and phase) as the wizard's launch overlay.
  const provisionalHasAudio = a === '1';
  const [show, warmth] = await Promise.all([getShowBySlug(id), getAnalyserWarmthState()]);
  const isWarm = warmth.active;

  // Race: the wizard navigates here client-side immediately on Generate,
  // before the server action has finished inserting the show row. While
  // creating=1 is set, render the splash; the component polls every few
  // seconds and the page re-renders with real data once the row appears.
  if (!show) {
    if (creating === '1') {
      const provisionalTitle = (t ?? '').trim() || 'Your show';
      return (
        <GeneratingShowAnimation
          showTitle={provisionalTitle}
          hasAudio={provisionalHasAudio}
          phase={provisionalHasAudio ? 'analysing' : 'generating'}
          isWarm={isWarm}
          randomiseCoverOnLoad
          persistKey={id}
          className={GENERATING_ROUTE_SPLASH_CLASS}
        />
      );
    }
    notFound();
  }

  const hasAudio = Boolean(show.audioPath || show.musicAnalysisId);

  // Slug collision guard: while `creating=1` the wizard is still waiting on
  // createShowAction. If the row we found is not mid-generation it predates
  // this click (an older show with the same slug); showing or handing over to
  // it would flash the wrong show. Keep the provisional splash up — the wizard
  // replaces the URL with the real (suffixed) slug the moment the action
  // returns.
  if (creating === '1' && show.generationStatus !== 'running') {
    const provisionalTitle = (t ?? '').trim() || 'Your show';
    return (
      <GeneratingShowAnimation
        showTitle={provisionalTitle}
        hasAudio={provisionalHasAudio}
        phase={provisionalHasAudio ? 'analysing' : 'generating'}
        isWarm={isWarm}
        randomiseCoverOnLoad
        persistKey={id}
        className={GENERATING_ROUTE_SPLASH_CLASS}
      />
    );
  }

  if (show.generationStatus === 'completed') {
    redirect(`/shows/${show.slug}/preview?autoplay=1`);
  }

  if (show.generationStatus === 'failed') {
    console.error('[shows/generating] generation failed:', {
      showId: show.id,
      error: show.generationError,
    });
    return (
      <Card elevation="high" radius="lg" className="mx-auto max-w-2xl p-8">
        <div className="flex items-start gap-4">
          <span className="bg-destructive/10 text-destructive rounded-lg p-3">
            <AlertTriangle size={22} aria-hidden="true" />
          </span>
          <div className="space-y-4">
            <div>
              <h1 className="text-foreground text-2xl font-semibold">Show generation failed</h1>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                We could not finish this show. Review it, then adjust the brief or start another
                show.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href={`/shows/${show.slug}/preview`} size="sm">
                Review show
              </Button>
              <Button href="/shows/new" size="sm" variant="secondary">
                Start another show
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Real pipeline phase for the progress card: `analysing` while the track
  // analysis is still running (cue generation waits on it), `generating` after.
  const analysisStatus =
    show.generationStatus === 'running' && show.musicAnalysisId
      ? await getMusicAnalysisStatus(show.musicAnalysisId)
      : null;
  const phase = analysisStatus === 'running' ? 'analysing' : 'generating';

  return (
    <GeneratingShowAnimation
      showTitle={show.title}
      status="running"
      phase={phase}
      hasAudio={hasAudio}
      isWarm={isWarm}
      startedAt={show.generationStartedAt}
      coverShader={creating === '1' ? null : show.coverShader}
      randomiseCoverOnLoad={creating === '1' || !show.coverShader}
      persistKey={show.slug}
      showId={show.id}
      coverImagePath={show.coverImagePath}
      className={GENERATING_ROUTE_SPLASH_CLASS}
    />
  );
}
