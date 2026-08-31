'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AudioLines,
  Check,
  Clock3,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Waves,
  type LucideIcon,
} from 'lucide-react';
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
import { setShowCoverImagePath } from '@/app/actions/show-cover-poster';
import { createClient } from '@/utils/supabase/client';
import { Cover } from '@/components/covers/Cover';
import styles from './GeneratingShowAnimation.module.css';

type GeneratingStatus = 'running' | 'completed' | 'failed';

/** Which part of the pipeline the show is actually in, fed from the server on
 * every poll so the bar tracks reality instead of a fixed script. */
type GeneratingPhase = 'analysing' | 'generating' | 'finalising';

type GeneratingShowAnimationProps = {
  className?: string;
  showTitle?: string;
  status?: GeneratingStatus;
  /** Real pipeline phase; `analysing` while the track analysis is running. */
  phase?: GeneratingPhase;
  /** Whether the show has a soundtrack (adds the analysis stage + estimate). */
  hasAudio?: boolean;
  pollIntervalMs?: number;
  startedAt?: string | null;
  /** When true, the analyser container is warmed up so the run is fast. */
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

type Stage = { label: string; icon: LucideIcon };

const AUDIO_STAGES: Stage[] = [
  { label: 'Analysing your track', icon: AudioLines },
  { label: 'Mapping beats and energy', icon: Waves },
  { label: 'Choosing fireworks', icon: Sparkles },
  { label: 'Timing cues to the music', icon: Clock3 },
  { label: 'Final safety checks', icon: ShieldCheck },
];

const NO_AUDIO_STAGES: Stage[] = [
  { label: 'Setting the rhythm', icon: Waves },
  { label: 'Choosing fireworks', icon: Sparkles },
  { label: 'Timing the cues', icon: Clock3 },
  { label: 'Final safety checks', icon: ShieldCheck },
];

const FINALISING_STAGE: Stage = { label: 'Loading the preview', icon: MonitorPlay };

// With a soundtrack the analysis dominates the wait, so it owns the first
// stretch of the bar and cue generation the remainder.
const ANALYSIS_BAR_SHARE = 0.55;
// Give up on capturing the cover poster after this many failed attempts so a
// broken WebGL context can't retry forever across poll refreshes.
const MAX_COVER_CAPTURE_ATTEMPTS = 2;

/** Rough wall-clock estimate for a phase, in seconds. LLM cue assignment can
 * run well past a minute, so the generating estimate leans conservative and
 * the eased curve keeps creeping (never finishing) on long runs. */
function phaseEstimateSeconds(phase: 'analysing' | 'generating', isWarm: boolean): number {
  if (phase === 'analysing') return isWarm ? 35 : 110;
  return isWarm ? 18 : 45;
}

/**
 * Eased 0→~1 curve: reaches ~0.89 at the estimate, then creeps asymptotically
 * so the bar keeps moving on slow runs without ever finishing early.
 */
function phaseCurve(elapsedSeconds: number, estimateSeconds: number): number {
  if (estimateSeconds <= 0) return 0.98;
  return Math.min(0.98, 1 - Math.exp(-2.2 * (elapsedSeconds / estimateSeconds)));
}

function formatEta(seconds: number): string {
  if (seconds <= 8) return 'almost there';
  if (seconds < 90) return `about ${Math.max(10, Math.round(seconds / 5) * 5)}s left`;
  return `about ${Math.ceil(seconds / 60)} min left`;
}

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
  percent: number;
  activeStageIndex: number;
  etaLabel: string | null;
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
  const progressFillRef = useRef<HTMLDivElement>(null);
  const coverCaptureAttemptsRef = useRef(0);
  const coverCaptureInFlightRef = useRef(false);
  // Wall-clock anchor for the current phase, so estimates restart when the
  // pipeline moves from analysis to generation.
  const phaseRef = useRef<GeneratingPhase>(phase);
  const phaseStartedAtRef = useRef<number | null>(null);
  // The bar never moves backwards, even if estimates or phases shift under it.
  const maxProgressRef = useRef(0);
  const [generatedCover, setGeneratedCover] = useState<ShowCover | null>(null);
  // The cover the user has been watching since they clicked Generate. While
  // the run is live it takes precedence over the show's saved cover so the
  // backdrop never switches mid-generation (launch overlay → provisional
  // splash → real slug → finalising all share it).
  const [sessionCover, setSessionCover] = useState<ShowCover | null>(null);
  const [progressUi, setProgressUi] = useState<ProgressUi>(() => ({
    percent: status === 'completed' ? 100 : 0,
    activeStageIndex: 0,
    etaLabel: null,
  }));

  const stages = useMemo(() => {
    const base = hasAudio ? AUDIO_STAGES : NO_AUDIO_STAGES;
    return phase === 'finalising' ? [...base, FINALISING_STAGE] : base;
  }, [hasAudio, phase]);

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
      // Entering a new phase: anchor its estimate to now. On the very first
      // render, anchor to the persisted overall start instead so a mid-run
      // refresh resumes in the right place.
      phaseStartedAtRef.current =
        phaseStartedAtRef.current === null ? resolvedStartedAt : Date.now();
      phaseRef.current = phase;
    }

    const generationEstimate = phaseEstimateSeconds('generating', isWarm);
    const analysisEstimate = phaseEstimateSeconds('analysing', isWarm);
    const generatingBase = hasAudio ? ANALYSIS_BAR_SHARE : 0;

    let animationFrame = 0;
    let lastPercent: number | null = null;
    let lastStageIndex: number | null = null;
    let lastEta: string | null = null;

    const tick = () => {
      const now = Date.now();
      const phaseElapsed = (now - (phaseStartedAtRef.current ?? resolvedStartedAt)) / 1000;

      let progress: number;
      let etaSeconds: number | null;
      if (status === 'completed') {
        progress = 1;
        etaSeconds = null;
      } else if (phase === 'finalising') {
        progress = Math.max(0.96, maxProgressRef.current) + Math.min(0.03, phaseElapsed * 0.004);
        etaSeconds = 5;
      } else if (phase === 'analysing') {
        progress = ANALYSIS_BAR_SHARE * phaseCurve(phaseElapsed, analysisEstimate);
        etaSeconds = Math.max(analysisEstimate - phaseElapsed, 4) + generationEstimate;
      } else {
        progress =
          generatingBase + (1 - generatingBase) * phaseCurve(phaseElapsed, generationEstimate);
        etaSeconds = Math.max(generationEstimate - phaseElapsed, 4);
      }

      progress = Math.min(status === 'completed' ? 1 : 0.99, progress);
      progress = Math.max(progress, maxProgressRef.current);
      maxProgressRef.current = progress;

      // Stage handoff: analysis owns stage 0; generation walks the remaining
      // stages as its share of the bar fills; finalising pins to the last row.
      let stageIndex: number;
      if (status === 'completed' || phase === 'finalising') {
        stageIndex = stages.length - 1;
      } else if (phase === 'analysing') {
        stageIndex = 0;
      } else {
        const generationStages = hasAudio ? stages.length - 1 : stages.length;
        const offset = hasAudio ? 1 : 0;
        const within = (progress - generatingBase) / Math.max(1 - generatingBase, 0.01);
        stageIndex = Math.min(offset + Math.floor(within * generationStages), stages.length - 1);
      }

      const percent = Math.round(progress * 100);
      const etaLabel = status === 'completed' || etaSeconds === null ? null : formatEta(etaSeconds);

      progressFillRef.current?.style.setProperty('--progress-scale', String(progress));

      if (percent !== lastPercent || stageIndex !== lastStageIndex || etaLabel !== lastEta) {
        lastPercent = percent;
        lastStageIndex = stageIndex;
        lastEta = etaLabel;
        setProgressUi({ percent, activeStageIndex: stageIndex, etaLabel });
      }

      if (status === 'running') {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    tick();

    return () => window.cancelAnimationFrame(animationFrame);
  }, [hasAudio, isWarm, persistKey, phase, stages, startedAt, status]);

  useEffect(() => {
    if (status !== 'running') return;
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

          <ol className={styles.stages} aria-label="Generation progress">
            {stages.map((stage, index) => {
              const isDone =
                status === 'completed' ||
                (index < progressUi.activeStageIndex && status !== 'failed');
              const isActive = status === 'running' && index === progressUi.activeStageIndex;
              const Icon = stage.icon;
              return (
                <li
                  key={stage.label}
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
                  <span className={styles.stageText}>{stage.label}</span>
                  {isActive ? <span className={styles.stageDots} aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ol>

          <div className={styles.barRow}>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuenow={progressUi.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div ref={progressFillRef} className={styles.progressFill} aria-hidden="true" />
            </div>
          </div>

          <div className={styles.meta}>
            <span className={styles.percent}>{progressUi.percent}%</span>
            <span className={styles.eta}>
              {status === 'completed' ? 'Show ready' : (progressUi.etaLabel ?? '')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
