'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AudioLines, Check, MonitorPlay, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  clearPersistedGenerationCover,
  clearPersistedGenerationStart,
  peekPersistedGenerationCover,
  resolveGenerationStartedAt,
  resolvePersistedGenerationCover,
} from '@/lib/generation-progress-storage';
import { isCssCover, randomCover, type ShowCover } from '@/lib/cover';
import { COVER_POSTER_VERSION, isCurrentCoverPosterPath } from '@/lib/cover-poster-url';
import { renderCoverToPng } from '@/lib/render-cover-poster';
import { setShowCoverImagePath } from '@/lib/shows/cover-actions.server';
import { createClient } from '@/lib/supabase/client';
import { Cover } from '@/ui/covers/Cover';
import styles from './GeneratingShowAnimation.module.css';
import { formatElapsed, stageStatusNote } from './generation-delay';

type GeneratingStatus = 'running' | 'completed' | 'failed';

/** Which part of the pipeline the show is actually in, fed from the server on
 * every poll so the checklist tracks reality instead of a fixed script. */
type GeneratingPhase = 'analysing' | 'generating' | 'finalising';

type GeneratingShowAnimationProps = {
  className?: string;
  showTitle?: string;
  status?: GeneratingStatus;
  /** Real pipeline phase; `analysing` while the track analysis is running. */
  phase?: GeneratingPhase;
  /** Whether the show has a soundtrack (adds the analysis stage). */
  hasAudio?: boolean;
  /** Null lets a caller own status polling and recovery. */
  pollIntervalMs?: number | null;
  startedAt?: string | null;
  /** When true, the analyser container is already warm; otherwise its cold start is explained. */
  isWarm?: boolean;
  /** Persisted visual identity for the show, rendered behind the progress card. */
  coverShader?: ShowCover | null;
  /** Generate a fresh cover once per browser page load when no saved cover is supplied. */
  randomiseCoverOnLoad?: boolean;
  /**
   * Stable key (typically the show slug) used to persist the start time in
   * sessionStorage so the bar resumes where it was after a refresh.
   */
  persistKey?: string;
  /** Show id; when set and no cover image exists yet, the live cover is captured to a poster. */
  showId?: string | null;
  /** Existing cover image path; when set, the capture step is skipped. */
  coverImagePath?: string | null;
};

/**
 * One real pipeline phase. The checklist only moves when the server reports
 * a new phase, so a tick always means that step genuinely finished.
 */
type Stage = {
  phase: GeneratingPhase;
  label: string;
  /** What is happening inside the step, shown while it is active. */
  description: string;
  icon: LucideIcon;
};

const ANALYSING_STAGE: Stage = {
  phase: 'analysing',
  label: 'Analysing your track',
  description: 'Finding the beats, sections and energy of the song.',
  icon: AudioLines,
};

const GENERATING_WITH_AUDIO_STAGE: Stage = {
  phase: 'generating',
  label: 'Composing your show',
  description: 'Choosing fireworks, timing cues to the music and checking launch safety.',
  icon: Sparkles,
};

const GENERATING_WITHOUT_AUDIO_STAGE: Stage = {
  phase: 'generating',
  label: 'Composing your show',
  description: 'Setting a rhythm, choosing fireworks, timing cues and checking launch safety.',
  icon: Sparkles,
};

const FINALISING_STAGE: Stage = {
  phase: 'finalising',
  label: 'Loading the preview',
  description: 'Preparing the replay.',
  icon: MonitorPlay,
};

// Give up on capturing the cover poster after this many failed attempts so a
// broken WebGL context can't retry forever across poll refreshes.
const MAX_COVER_CAPTURE_ATTEMPTS = 2;

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((record, key) => {
      record[key] = stableJson((value as Record<string, unknown>)[key]);
      return record;
    }, {});
}

function coverSignature(cover: ShowCover | null | undefined): string | null {
  if (!cover) return null;
  try {
    return JSON.stringify(stableJson(cover));
  } catch {
    return null;
  }
}

type ProgressUi = {
  /** Whole seconds since the run started, for the elapsed readout. */
  elapsedSeconds: number;
  /** Context line for the active step. */
  statusNote: string;
};

export function GeneratingShowAnimation({
  className,
  showTitle,
  status = 'running',
  phase = 'generating',
  hasAudio = false,
  pollIntervalMs = 2500,
  startedAt,
  isWarm = false,
  coverShader,
  randomiseCoverOnLoad = false,
  persistKey,
  showId = null,
  coverImagePath = null,
}: GeneratingShowAnimationProps) {
  const router = useRouter();
  const coverCaptureAttemptsRef = useRef(0);
  const coverCaptureInFlightRef = useRef(false);
  // Wall-clock anchor for the current phase, so the delay note restarts when
  // the pipeline moves from analysis to generation.
  const phaseRef = useRef<GeneratingPhase>(phase);
  const phaseStartedAtRef = useRef<number | null>(null);
  const [generatedCover, setGeneratedCover] = useState<ShowCover | null>(null);
  // The cover the user has been watching since they clicked Generate. While
  // the run is live it takes precedence over the show's saved cover so the
  // backdrop never switches mid-generation (launch overlay → provisional
  // splash → real slug → finalising all share it).
  const [sessionCover, setSessionCover] = useState<ShowCover | null>(null);
  const [progressUi, setProgressUi] = useState<ProgressUi>(() => ({
    elapsedSeconds: 0,
    statusNote: stageStatusNote({ phase, hasAudio, isWarm, phaseElapsedSeconds: 0 }),
  }));

  const stages = useMemo<Stage[]>(() => {
    const base = hasAudio
      ? [ANALYSING_STAGE, GENERATING_WITH_AUDIO_STAGE]
      : [GENERATING_WITHOUT_AUDIO_STAGE];
    return phase === 'finalising' ? [...base, FINALISING_STAGE] : base;
  }, [hasAudio, phase]);
  // The active row follows the server-reported phase, so a tick is earned.
  const activeStageIndex =
    status === 'completed'
      ? stages.length
      : Math.max(
          0,
          stages.findIndex((stage) => stage.phase === phase),
        );

  // Layout effects: each splash surface (launch overlay → route splash →
  // handover) remounts this component, so the cover must be committed before
  // the first paint or every hop flashes a coverless frame.
  useLayoutEffect(() => {
    if (!randomiseCoverOnLoad || coverShader) {
      setGeneratedCover(null);
      return;
    }
    // Reuse the session-persisted cover for this slug when there is one, so
    // the wizard's launch overlay and this route splash share a backdrop.
    setGeneratedCover(persistKey ? resolvePersistedGenerationCover(persistKey) : randomCover());
  }, [coverShader, persistKey, randomiseCoverOnLoad]);

  useLayoutEffect(() => {
    if (status !== 'running' || !persistKey) {
      setSessionCover(null);
      return;
    }
    setSessionCover(peekPersistedGenerationCover(persistKey));
  }, [status, persistKey]);

  // Milliseconds of run time already elapsed when this instance mounted.
  // Advancing the shader frame by it makes each remount continue the cover
  // animation from where the previous surface left off instead of visibly
  // restarting it from the cover's saved start frame.
  const [coverElapsedMs] = useState(() =>
    typeof window === 'undefined' || !persistKey
      ? 0
      : Math.max(0, Date.now() - resolveGenerationStartedAt(persistKey)),
  );

  useEffect(() => {
    const fallbackStartedAt = startedAt ? Date.parse(startedAt) : Date.now();
    const resolvedStartedAt = resolveGenerationStartedAt(
      persistKey,
      Number.isFinite(fallbackStartedAt) ? fallbackStartedAt : Date.now(),
    );
    if (phaseRef.current !== phase || phaseStartedAtRef.current === null) {
      // Entering a new phase: anchor its delay note to now. On the very first
      // render, anchor to the persisted overall start instead so a mid-run
      // refresh resumes in the right place.
      phaseStartedAtRef.current =
        phaseStartedAtRef.current === null ? resolvedStartedAt : Date.now();
      phaseRef.current = phase;
    }

    const tick = () => {
      const now = Date.now();
      const phaseElapsedSeconds = (now - (phaseStartedAtRef.current ?? resolvedStartedAt)) / 1000;
      const next: ProgressUi = {
        elapsedSeconds: Math.max(0, Math.floor((now - resolvedStartedAt) / 1000)),
        statusNote:
          status === 'completed'
            ? 'Show ready'
            : stageStatusNote({ phase, hasAudio, isWarm, phaseElapsedSeconds }),
      };
      setProgressUi((previous) =>
        previous.elapsedSeconds === next.elapsedSeconds && previous.statusNote === next.statusNote
          ? previous
          : next,
      );
    };

    tick();
    if (status !== 'running') return;
    // Once a second is enough for an m:ss readout and avoids a render per frame.
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [hasAudio, isWarm, persistKey, phase, startedAt, status]);

  useEffect(() => {
    if (status !== 'running' || pollIntervalMs === null) return;
    const refresh = window.setInterval(() => router.refresh(), pollIntervalMs);
    return () => window.clearInterval(refresh);
  }, [router, status, pollIntervalMs]);

  useEffect(() => {
    if (status !== 'completed') return;
    clearPersistedGenerationStart(persistKey);
    clearPersistedGenerationCover(persistKey);
  }, [status, persistKey]);

  const activeCover = sessionCover ?? coverShader ?? generatedCover;

  // Rendered copy of the cover with its clock resumed; the unadjusted config
  // still drives the poster capture below so saved covers stay deterministic.
  // CSS covers phase in real seconds; WebGL shader frames advance with speed.
  const displayCover = useMemo(() => {
    if (!activeCover || !coverElapsedMs || !activeCover.speed) return activeCover;
    if (isCssCover(activeCover)) {
      return { ...activeCover, frame: activeCover.frame + coverElapsedMs / 1000 };
    }
    return { ...activeCover, frame: activeCover.frame + coverElapsedMs * activeCover.speed };
  }, [activeCover, coverElapsedMs]);

  // Render the cover to a small poster once and persist it so browse pages can
  // show an <img> instead of a live WebGL context per card. Skipped when the
  // show already has a current-version cover image, or when the show row is not yet available
  // (the creating=1 provisional splash); the polling refresh re-runs this once
  // the row exists. Failures never block generation; after
  // MAX_COVER_CAPTURE_ATTEMPTS the capture stops retrying so a broken WebGL
  // context or storage rejection cannot spam errors across poll refreshes.
  useEffect(() => {
    const activeCoverMatchesStored = coverSignature(activeCover) === coverSignature(coverShader);
    const hasCurrentPosterForActiveCover =
      isCurrentCoverPosterPath(coverImagePath) && activeCoverMatchesStored;
    if (!showId || !activeCover || hasCurrentPosterForActiveCover) return;
    if (coverCaptureInFlightRef.current) return;
    if (coverCaptureAttemptsRef.current >= MAX_COVER_CAPTURE_ATTEMPTS) return;
    coverCaptureInFlightRef.current = true;
    coverCaptureAttemptsRef.current += 1;

    void (async () => {
      try {
        const dataUrl = await renderCoverToPng(activeCover);
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const blob = await (await fetch(dataUrl)).blob();
        if (!blob.type.startsWith('image/')) {
          throw new Error(`cover capture produced unexpected mime type: ${blob.type}`);
        }
        const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';
        const path = `${user.id}/${showId}-${COVER_POSTER_VERSION}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('covers').upload(path, blob, {
          contentType: blob.type,
          cacheControl: 'public, max-age=31536000, immutable',
          upsert: true,
        });
        if (uploadError) {
          console.error('[cover-poster] upload failed:', uploadError);
          return;
        }
        await setShowCoverImagePath(showId, path, activeCover);
        // Success: make sure later refreshes never re-enter.
        coverCaptureAttemptsRef.current = MAX_COVER_CAPTURE_ATTEMPTS;
      } catch (error) {
        console.error('[cover-poster] capture failed:', error);
      } finally {
        coverCaptureInFlightRef.current = false;
      }
    })();
  }, [showId, activeCover, coverShader, coverImagePath]);

  return (
    <section
      aria-label="Generating show"
      className={cn(styles.stage, displayCover && styles.hasCover, className)}
    >
      {displayCover ? (
        <div className={styles.shaderLayer} aria-hidden="true">
          <Cover cover={displayCover} />
        </div>
      ) : null}
      <div className={styles.overlay}>
        <div className={styles.card}>
          <div className={styles.header}>
            <p className={styles.eyebrow}>Generating show</p>
            {showTitle ? <h1 className={styles.title}>{showTitle}</h1> : null}
          </div>

          <ol className={styles.stages} aria-label="Generation steps">
            {stages.map((stage, index) => {
              const isDone = status !== 'failed' && index < activeStageIndex;
              const isActive = status === 'running' && index === activeStageIndex;
              const Icon = stage.icon;
              return (
                <li
                  key={stage.phase}
                  className={cn(
                    styles.stageRow,
                    isDone && styles.stageDone,
                    isActive && styles.stageActive,
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className={styles.stageIcon} aria-hidden="true">
                    {isDone ? (
                      <Check size={14} strokeWidth={2.75} />
                    ) : (
                      <Icon size={14} strokeWidth={2} />
                    )}
                    {isActive ? <span className={styles.stageIconPulse} /> : null}
                  </span>
                  <span className={styles.stageBody}>
                    <span className={styles.stageText}>
                      {stage.label}
                      {isActive ? <span className={styles.stageDots} aria-hidden="true" /> : null}
                    </span>
                    {isActive ? (
                      <span className={styles.stageDescription}>{stage.description}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* One segment per real step. The active segment sweeps instead of
              pretending to know how far through the step we are. */}
          <div
            className={styles.segments}
            role="progressbar"
            aria-label="Generation progress"
            aria-valuetext={
              status === 'completed'
                ? 'Show ready'
                : `Step ${Math.min(activeStageIndex + 1, stages.length)} of ${stages.length}: ${
                    stages[Math.min(activeStageIndex, stages.length - 1)]?.label ?? ''
                  }`
            }
          >
            {stages.map((stage, index) => (
              <span
                key={stage.phase}
                className={cn(
                  styles.segment,
                  (status === 'completed' || index < activeStageIndex) && styles.segmentDone,
                  status === 'running' && index === activeStageIndex && styles.segmentActive,
                )}
              />
            ))}
          </div>

          <div className={styles.meta}>
            <span className={styles.statusNote} role="status" aria-live="polite">
              {progressUi.statusNote}
            </span>
            <span className={styles.elapsed}>
              <span className="sr-only">Elapsed </span>
              {formatElapsed(progressUi.elapsedSeconds)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
