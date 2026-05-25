'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/app/components/ui/Card';
import { StatTile } from '@/app/components/ui/StatTile';
import { formatStableDateTime } from '@/lib/show-domain';
import type { ShowAnalysisSnapshot } from '@/lib/show-analysis.types';

type AudioAnalysisTimelineProps = {
  hasAudio: boolean;
  durationSeconds: number | null;
  initialAnalysis: ShowAnalysisSnapshot | null;
};

function statusText(hasAudio: boolean, analysis: ShowAnalysisSnapshot | null): string {
  if (!hasAudio) return 'No audio';
  if (!analysis) return 'Queued';
  if (analysis.status === 'completed') return 'Context ready';
  if (analysis.status === 'failed') return 'Failed';
  return 'Analysing';
}

function statusDescription(hasAudio: boolean, analysis: ShowAnalysisSnapshot | null): string {
  if (!hasAudio) return 'Upload audio when creating the show to generate song context.';
  if (!analysis) return 'The analysis starts automatically after the track uploads.';
  if (analysis.status === 'running') return 'The server is analysing the uploaded audio.';
  if (analysis.status === 'failed') {
    return analysis.errorMessage ?? 'The analyser could not process this audio.';
  }
  return 'Song context has been generated for downstream show planning.';
}

function runtimeSeconds(runtimeMs: number | null): number | string {
  return runtimeMs ? Math.max(1, Math.round(runtimeMs / 1000)) : '-';
}

export function AudioAnalysisTimeline({
  hasAudio,
  durationSeconds,
  initialAnalysis,
}: AudioAnalysisTimelineProps) {
  const router = useRouter();
  const shouldRefresh = hasAudio && (!initialAnalysis || initialAnalysis.status === 'running');
  const contextPreview = initialAnalysis?.contextMarkdown
    ? initialAnalysis.contextMarkdown.slice(0, 2400)
    : null;

  useEffect(() => {
    if (!shouldRefresh) return;
    const interval = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [router, shouldRefresh]);

  return (
    <Card elevation="low" radius="md" className="relative overflow-hidden p-6 lg:col-span-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-outline-variant/45 bg-surface text-on-surface-variant inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-bold tracking-[0.14em] uppercase">
              {statusText(hasAudio, initialAnalysis)}
            </span>
            {initialAnalysis?.schemaVersion ? (
              <span className="bg-primary/10 text-primary inline-flex h-8 items-center rounded-full px-3 text-xs font-bold">
                schema {initialAnalysis.schemaVersion}
              </span>
            ) : null}
          </div>
          <h2 className="text-on-surface text-xl font-extrabold">Song context</h2>
          <p className="text-on-surface-variant max-w-2xl text-sm leading-relaxed">
            {statusDescription(hasAudio, initialAnalysis)}
          </p>
        </div>
      </div>

      {initialAnalysis?.status === 'failed' ? (
        <div className="border-error/35 bg-error/10 text-on-surface mb-5 flex items-start gap-3 rounded-lg border p-4 text-sm">
          <span>{initialAnalysis.errorMessage ?? 'Analysis failed.'}</span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Status" value={statusText(hasAudio, initialAnalysis)} />
        <StatTile
          label="Requested length"
          value={durationSeconds ? Math.round(durationSeconds / 60) : '-'}
          unit={durationSeconds ? 'min' : undefined}
        />
        <StatTile
          label="Runtime"
          value={runtimeSeconds(initialAnalysis?.runtimeMs ?? null)}
          unit={initialAnalysis?.runtimeMs ? 's' : undefined}
        />
        <StatTile label="Completed" value={initialAnalysis?.completedAt ? 'Yes' : '-'} />
      </div>

      <div className="border-outline-variant/45 bg-surface/70 mt-7 rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-on-surface-variant text-xs font-bold tracking-widest uppercase">
            Context preview
          </span>
          {initialAnalysis?.completedAt ? (
            <span className="text-on-surface-variant text-xs font-semibold">
              {formatStableDateTime(initialAnalysis.completedAt)}
            </span>
          ) : null}
        </div>

        {contextPreview ? (
          <pre className="bg-surface-container-low text-on-surface max-h-[420px] overflow-auto rounded-md p-4 text-xs leading-relaxed whitespace-pre-wrap">
            {contextPreview}
          </pre>
        ) : (
          <div className="bg-surface-container-low text-on-surface-variant rounded-md p-4 text-sm">
            {hasAudio
              ? 'Song context will appear here when the background analysis finishes.'
              : 'No song context is available without audio.'}
          </div>
        )}
      </div>
    </Card>
  );
}
