/** Interstitial route rendered while the cue-generation pipeline runs for a newly-created show. */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { GeneratingShowAnimation } from '@/app/components/app/GeneratingShowAnimation';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { getAnalyserWarmthState } from '@/lib/analyser-warmth.server';
import { getShowBySlug, listReplayCuesForShow } from '@/lib/shows.server';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creating?: string; t?: string }>;
};

const SPLASH_CLASS =
  '-mx-6 -mt-6 -mb-10 min-h-[calc(100svh-3.5rem)] flex-1 sm:-mx-8 sm:-mb-12 lg:-mx-10';

export default async function ShowGeneratingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { creating, t } = await searchParams;
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
          isWarm={isWarm}
          randomiseCoverOnLoad
          persistKey={id}
          className={SPLASH_CLASS}
        />
      );
    }
    notFound();
  }

  const cues = await listReplayCuesForShow(show.id);
  if (cues.length > 0 && show.generationStatus === 'completed') {
    redirect(`/shows/${show.slug}/preview`);
  }

  if (show.generationStatus === 'failed') {
    return (
      <Card elevation="high" radius="lg" className="mx-auto max-w-2xl p-8">
        <div className="flex items-start gap-4">
          <span className="bg-error/10 text-error rounded-xl p-3">
            <AlertTriangle size={22} />
          </span>
          <div className="space-y-4">
            <div>
              <h2 className="text-on-surface text-2xl font-black">Show generation failed</h2>
              <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                {show.generationError ??
                  'The generator could not finish this run. Adjust the brief and try again.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href={`/shows/${show.slug}/preview`} size="sm">
                Back to preview
              </Button>
              <Link
                href={`/shows/${show.slug}/preview`}
                className="border-outline/20 text-primary hover:bg-surface-container-highest inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold"
              >
                Open preview
              </Link>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <GeneratingShowAnimation
      showTitle={show.title}
      status={show.generationStatus === 'completed' ? 'completed' : 'running'}
      isWarm={isWarm}
      startedAt={show.generationStartedAt}
      coverShader={creating === '1' ? null : show.coverShader}
      randomiseCoverOnLoad={creating === '1' || !show.coverShader}
      persistKey={show.slug}
      className={SPLASH_CLASS}
    />
  );
}
