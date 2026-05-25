/** Timeline tab visualising analysed audio aligned with the show's cues. */

import { notFound } from 'next/navigation';
import { AudioAnalysisTimeline } from '@/app/components/app/AudioAnalysisTimeline';
import { Card } from '@/app/components/ui/Card';
import { getLatestAnalysisForShow } from '@/lib/show-analyses.server';
import { getShowBySlug } from '@/lib/shows.server';

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowTimelinePage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  const latestAnalysis = await getLatestAnalysisForShow(show.id);
  const contextWordCount = latestAnalysis?.contextMarkdown
    ? latestAnalysis.contextMarkdown.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <AudioAnalysisTimeline
        hasAudio={Boolean(show.audioPath)}
        durationSeconds={show.durationSeconds}
        initialAnalysis={latestAnalysis}
      />

      <div className="space-y-6 lg:col-span-4">
        <Card elevation="high" radius="md" className="space-y-5 p-6">
          <h3 className="text-on-surface text-lg font-bold">Stored song context</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            The analyser saves rich timing JSON for generation and a readable Markdown context for
            inspection.
          </p>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="border-outline-variant/55 rounded-lg border p-3">
              <dt className="text-on-surface-variant text-xs font-bold tracking-widest uppercase">
                Context
              </dt>
              <dd className="text-on-surface mt-2 text-2xl font-black">
                {latestAnalysis?.contextMarkdown ? 'Ready' : '—'}
              </dd>
            </div>
            <div className="border-outline-variant/55 rounded-lg border p-3">
              <dt className="text-on-surface-variant text-xs font-bold tracking-widest uppercase">
                Words
              </dt>
              <dd className="text-on-surface mt-2 text-sm font-bold">{contextWordCount || '—'}</dd>
            </div>
            <div className="border-outline-variant/55 rounded-lg border p-3">
              <dt className="text-on-surface-variant text-xs font-bold tracking-widest uppercase">
                Status
              </dt>
              <dd className="text-on-surface mt-2 text-sm font-bold">
                {latestAnalysis?.status ?? 'Queued'}
              </dd>
            </div>
            <div className="border-outline-variant/55 rounded-lg border p-3">
              <dt className="text-on-surface-variant text-xs font-bold tracking-widest uppercase">
                Audio
              </dt>
              <dd className="text-on-surface mt-2 text-sm font-bold">
                {show.audioPath ? 'Uploaded' : 'Missing'}
              </dd>
            </div>
          </dl>
        </Card>

        <Card elevation="low" radius="md" className="space-y-4 p-6">
          <h4 className="text-on-surface-variant text-xs font-bold tracking-widest uppercase">
            Version history
          </h4>
          <ul className="space-y-2">
            <li className="bg-surface-container-highest flex items-center justify-between rounded-lg p-3">
              <span className="text-sm font-medium">Current version</span>
              <span className="text-primary text-[10px] tracking-widest uppercase">Active</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
