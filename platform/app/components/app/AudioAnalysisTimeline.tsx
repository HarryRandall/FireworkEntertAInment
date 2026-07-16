'use client';

/**
 * Client card that surfaces generated song context for a show. While analysis
 * is running, it polls a scoped JSON endpoint so this card can update without
 * refreshing the surrounding route.
 */
import { useEffect, useState } from 'react';
import { Card } from '@/app/components/ui/Card';
import type {
  AnalyserKeyMoment,
  AnalyserResult,
  ShowAnalysisSnapshot,
} from '@/lib/show-analysis.types';

type AudioAnalysisTimelineProps = {
  hasAudio: boolean;
  initialAnalysis: ShowAnalysisSnapshot | null;
};

const POLL_INTERVAL_MS = 5000;

function parseAnalysisResponse(value: unknown): ShowAnalysisSnapshot | null {
  if (typeof value !== 'object' || value === null || !('analysis' in value)) return null;
  const analysis = value.analysis;
  if (
    typeof analysis !== 'object' ||
    analysis === null ||
    !('id' in analysis) ||
    typeof analysis.id !== 'string' ||
    !('showId' in analysis) ||
    typeof analysis.showId !== 'string' ||
    !('status' in analysis) ||
    (analysis.status !== 'running' &&
      analysis.status !== 'completed' &&
      analysis.status !== 'failed')
  ) {
    return null;
  }
  return analysis as ShowAnalysisSnapshot;
}

function statusAnnouncement(hasAudio: boolean, analysis: ShowAnalysisSnapshot | null): string {
  if (!hasAudio) return 'No audio is available for song analysis.';
  if (!analysis) return 'Song analysis is not available.';
  if (analysis.status === 'running') return 'Song analysis is in progress.';
  if (analysis.status === 'failed') return 'Song analysis failed.';
  return 'Song analysis completed.';
}

function statusDescription(hasAudio: boolean, analysis: ShowAnalysisSnapshot | null): string {
  if (!hasAudio) return 'Upload audio when creating the show to generate song context.';
  if (!analysis) return 'The analysis starts automatically after the track uploads.';
  if (analysis.status === 'running') return 'The server is analysing the uploaded audio.';
  if (analysis.status === 'failed') {
    return analysis.errorMessage ?? 'The analyser could not process this audio.';
  }
  return 'The analysis finished, but no readable song context was saved for this track.';
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '-';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function formatKey(analysis: AnalyserResult | null): string {
  const keySignature = analysis?.music_profile?.key_signature;
  return [keySignature?.root, keySignature?.mode].filter(Boolean).join(' ') || '-';
}

function getStrongestMoment(moments: AnalyserKeyMoment[] | undefined): AnalyserKeyMoment | null {
  if (!moments?.length) return null;
  return moments.reduce((strongest, moment) =>
    moment.prominence > strongest.prominence ? moment : strongest,
  );
}

function buildKpis(analysis: AnalyserResult | null) {
  if (!analysis) return [];

  const keyMoments = analysis.key_moments ?? [];
  const sections = analysis.sections ?? [];
  const climaxCount = keyMoments.filter((moment) => moment.type === 'climax').length;
  const strongestMoment = getStrongestMoment(keyMoments);
  const traits = analysis.music_profile?.dominant_traits?.slice(0, 3).join(', ');
  const palette = [
    analysis.show_personality?.palette_direction?.primary,
    analysis.show_personality?.palette_direction?.secondary,
    analysis.show_personality?.palette_direction?.accent,
  ]
    .filter(Boolean)
    .join(' / ');

  return [
    {
      label: 'Duration',
      value: formatTime(analysis.duration_seconds),
      detail: `${formatNumber(analysis.total_beats)} beats`,
    },
    {
      label: 'Tempo',
      value: `${formatNumber(analysis.tempo_bpm)} BPM`,
      detail: formatKey(analysis),
    },
    {
      label: 'Structure',
      value: `${sections.length} sections`,
      detail: `${climaxCount} climaxes`,
    },
    {
      label: 'Style',
      value: analysis.music_profile?.genre_hint ?? '-',
      detail: traits || 'No dominant traits',
    },
    {
      label: 'Palette',
      value: palette || '-',
      detail: analysis.show_personality?.density_level
        ? `${analysis.show_personality.density_level} density`
        : 'No density hint',
    },
    {
      label: 'Strongest moment',
      value: formatTime(strongestMoment?.time),
      detail: strongestMoment ? `${formatNumber(strongestMoment.energy * 100)}% energy` : '-',
    },
  ];
}

function KpiTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-outline-variant/55 bg-surface-container-low rounded-lg border p-4">
      <div className="text-on-surface-variant text-xs font-bold tracking-widest uppercase">
        {label}
      </div>
      <div className="text-on-surface mt-2 text-xl font-semibold [overflow-wrap:anywhere] break-words tabular-nums">
        {value}
      </div>
      <div className="text-on-surface-variant mt-1 min-h-5 text-xs leading-relaxed [overflow-wrap:anywhere] break-words">
        {detail}
      </div>
    </div>
  );
}

export function AudioAnalysisTimeline({ hasAudio, initialAnalysis }: AudioAnalysisTimelineProps) {
  // Tie the client result to its server seed so navigation cannot reuse a
  // previous show's locally polled snapshot.
  const [pollState, setPollState] = useState(() => ({
    source: initialAnalysis,
    value: initialAnalysis,
  }));
  const analysis = pollState.source === initialAnalysis ? pollState.value : initialAnalysis;
  const activeShowId = hasAudio && analysis?.status === 'running' ? analysis.showId : null;
  const contextMarkdown = analysis?.contextMarkdown ?? null;
  const showStatusCopy = !contextMarkdown || analysis?.status !== 'completed';
  const kpis = buildKpis(analysis?.analysis ?? null);

  useEffect(() => {
    if (!activeShowId) return;
    const showId = activeShowId;

    let cancelled = false;
    let timeoutId: number | null = null;
    let requestController: AbortController | null = null;
    let analysisIsRunning = true;

    function schedulePoll(delay: number) {
      if (cancelled || !analysisIsRunning || document.visibilityState === 'hidden') return;
      timeoutId = window.setTimeout(poll, delay);
    }

    async function poll() {
      timeoutId = null;
      if (cancelled || document.visibilityState === 'hidden') return;

      requestController = new AbortController();
      try {
        const response = await fetch(`/api/shows/${encodeURIComponent(showId)}/analysis`, {
          cache: 'no-store',
          signal: requestController.signal,
        });
        if (!response.ok) return;

        const nextAnalysis = parseAnalysisResponse(await response.json());
        if (cancelled || !nextAnalysis) return;

        analysisIsRunning = nextAnalysis.status === 'running';
        if (!analysisIsRunning) {
          setPollState({ source: initialAnalysis, value: nextAnalysis });
        }
      } catch {
        // A transient request failure does not change the analyser's state.
      } finally {
        requestController = null;
        schedulePoll(POLL_INTERVAL_MS);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        timeoutId = null;
        requestController?.abort();
        return;
      }
      if (timeoutId === null && requestController === null) schedulePoll(0);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    schedulePoll(POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      requestController?.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeShowId, initialAnalysis]);

  return (
    <div className="space-y-5">
      {kpis.length ? (
        <section aria-label="Song planning summary">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {kpis.map((kpi) => (
              <KpiTile key={kpi.label} {...kpi} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusAnnouncement(hasAudio, analysis)}
      </p>

      <Card
        elevation="low"
        radius="md"
        className="relative p-6"
        aria-busy={analysis?.status === 'running'}
      >
        <div className="mb-5 space-y-2">
          <h2 className="text-on-surface text-xl font-extrabold">Song context</h2>
          {showStatusCopy ? (
            <p className="text-on-surface-variant max-w-2xl text-sm leading-relaxed">
              {statusDescription(hasAudio, analysis)}
            </p>
          ) : null}
        </div>

        {analysis?.status === 'failed' ? (
          <div className="border-error/35 bg-error/10 text-on-surface mb-5 flex items-start gap-3 rounded-lg border p-4 text-sm">
            <span>{analysis.errorMessage ?? 'Analysis failed.'}</span>
          </div>
        ) : null}

        {contextMarkdown ? (
          <pre className="bg-surface-container-low text-on-surface max-w-full overflow-visible rounded-md p-4 text-xs leading-relaxed [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
            {contextMarkdown}
          </pre>
        ) : (
          <div className="bg-surface-container-low text-on-surface-variant rounded-md p-4 text-sm">
            {hasAudio
              ? 'Song context will appear here when the background analysis finishes.'
              : 'No song context is available without audio.'}
          </div>
        )}
      </Card>
    </div>
  );
}
