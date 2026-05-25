/** Interstitial route rendered while the cue-generation pipeline runs for a newly-created show. */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { ShowGenerationSplash } from '@/app/components/app/ShowGenerationSplash';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { getShowBySlug, listReplayCuesForShow } from '@/lib/shows.server';

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowGeneratingPage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();

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
              <Button href={`/shows/${show.slug}`} size="sm">
                Back to brief
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

  return <ShowGenerationSplash showTitle={show.title} />;
}
