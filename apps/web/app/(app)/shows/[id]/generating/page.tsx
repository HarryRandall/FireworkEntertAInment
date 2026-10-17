/** Interstitial route rendered while the cue-generation pipeline runs for a newly-created show. */

import { notFound, redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { GeneratingShowAnimation } from '@/ui/shows/GeneratingShowAnimation';
import { GENERATING_ROUTE_SPLASH_CLASS } from '@/ui/shows/generatingSplashLayout';
import { Button } from '@/ui/patterns/Button';
import { Card } from '@/ui/patterns/Card';
import { getAnalyserWarmthState } from '@/lib/analyser-warmth.server';
import { describeGenerationFailure } from '@/lib/cue-generation/failure-presentation';
import { getMusicAnalysisStatus } from '@/lib/show-analyses.server';
import { getShowBySlug } from '@/lib/shows/queries.server';

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
    // The stored message is operator detail; the page only shows curated copy.
    console.error('[shows/generating] generation failed:', {
      showId: show.id,
      error: show.generationError,
    });
    const failure = describeGenerationFailure(show.generationError);
    const hasPartialResult = (show.generatedCueCount ?? 0) > 0;
    const soundtrack = [show.song, show.artist].filter(Boolean).join(' - ');
    return (
      <Card radius="lg" className="mx-auto w-full max-w-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="bg-status-danger-subtle text-status-danger inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg">
            <AlertTriangle size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 space-y-5">
            <div className="space-y-2">
              <p className="text-muted-foreground font-mono text-[0.6875rem] font-semibold tracking-[0.18em] uppercase">
                {show.title}
              </p>
              <h1 className="text-foreground text-2xl font-bold tracking-tight">
                Show generation failed
              </h1>
              {soundtrack ? (
                <p className="text-muted-foreground text-xs">Soundtrack: {soundtrack}</p>
              ) : null}
              <p className="text-foreground text-sm leading-relaxed">{failure.summary}</p>
              {failure.detail ? (
                <p className="text-muted-foreground text-sm leading-relaxed">{failure.detail}</p>
              ) : null}
            </div>

            <div className="border-border bg-muted/40 rounded-lg border p-4">
              <h2 className="text-foreground text-sm font-semibold">What you can do</h2>
              <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {hasPartialResult ? (
                  <li>Review the cues that were generated before it stopped.</li>
                ) : null}
                {failure.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 text-xs">{failure.creditsNote}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              {hasPartialResult ? (
                <Button href={`/shows/${show.slug}/preview`} size="sm">
                  Review show
                </Button>
              ) : (
                <Button href="/shows" size="sm">
                  Back to My Shows
                </Button>
              )}
              <Button href="/shows/new" size="sm" variant="secondary">
                Start another show
              </Button>
              {hasPartialResult ? (
                <Button href="/shows" size="sm" variant="ghost">
                  Back to My Shows
                </Button>
              ) : null}
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
