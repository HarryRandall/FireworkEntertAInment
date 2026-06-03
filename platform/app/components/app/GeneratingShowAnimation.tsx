'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  clearPersistedGenerationStart,
  resolveGenerationStartedAt,
} from '@/lib/generation-progress-storage';
import styles from './GeneratingShowAnimation.module.css';

type GeneratingStatus = 'running' | 'completed' | 'failed';

type GeneratingShowAnimationProps = {
  className?: string;
  showTitle?: string;
  status?: GeneratingStatus;
  pollIntervalMs?: number;
  startedAt?: string | null;
  /** When true, the analyser container is warmed up so the run is fast. */
  isWarm?: boolean;
  /**
   * Stable key (typically the show slug) used to persist the start time in
   * sessionStorage so the bar resumes where it was after a refresh.
   */
  persistKey?: string;
};

type Stage = { label: string; minProgress: number };
type ProgressUi = { percent: number; stageLabel: string };
type ProgressPoint = { elapsedSeconds: number; progress: number };

const STAGES: Stage[] = [
  { label: 'Reading the brief', minProgress: 0 },
  { label: 'Decoding the music', minProgress: 0.1 },
  { label: 'Mapping song structure', minProgress: 0.22 },
  { label: 'Selecting fireworks', minProgress: 0.36 },
  { label: 'Timing cues to the beat', minProgress: 0.52 },
  { label: 'Checking tube overlap', minProgress: 0.7 },
  { label: 'Polishing the timeline', minProgress: 0.82 },
  { label: 'Almost ready', minProgress: 0.9 },
];

const COLD_PROGRESS_POINTS: ProgressPoint[] = [
  { elapsedSeconds: 0, progress: 0 },
  { elapsedSeconds: 4, progress: 0.06 },
  { elapsedSeconds: 12, progress: 0.16 },
  { elapsedSeconds: 26, progress: 0.27 },
  { elapsedSeconds: 42, progress: 0.38 },
  { elapsedSeconds: 64, progress: 0.52 },
  { elapsedSeconds: 84, progress: 0.7 },
  { elapsedSeconds: 100, progress: 0.82 },
  { elapsedSeconds: 112, progress: 0.9 },
  { elapsedSeconds: 120, progress: 0.92 },
];

const WARM_PROGRESS_POINTS: ProgressPoint[] = [
  { elapsedSeconds: 0, progress: 0 },
  { elapsedSeconds: 2, progress: 0.08 },
  { elapsedSeconds: 5, progress: 0.2 },
  { elapsedSeconds: 9, progress: 0.35 },
  { elapsedSeconds: 14, progress: 0.52 },
  { elapsedSeconds: 19, progress: 0.7 },
  { elapsedSeconds: 23, progress: 0.82 },
  { elapsedSeconds: 27, progress: 0.9 },
  { elapsedSeconds: 30, progress: 0.92 },
];

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function progressAtElapsed(elapsedSeconds: number, warm: boolean): number {
  const points = warm ? WARM_PROGRESS_POINTS : COLD_PROGRESS_POINTS;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const next = points[index]!;
    if (elapsedSeconds <= next.elapsedSeconds) {
      const span = next.elapsedSeconds - previous.elapsedSeconds;
      const localProgress = span > 0 ? (elapsedSeconds - previous.elapsedSeconds) / span : 1;
      const eased = smoothstep(Math.min(1, Math.max(0, localProgress)));
      return previous.progress + (next.progress - previous.progress) * eased;
    }
  }

  return points[points.length - 1]!.progress;
}

function pickStage(progress: number): Stage {
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (progress >= stage.minProgress) current = stage;
  }
  return current;
}

export function GeneratingShowAnimation({
  className,
  showTitle,
  status = 'running',
  pollIntervalMs = 2500,
  startedAt,
  isWarm = false,
  persistKey,
}: GeneratingShowAnimationProps) {
  const router = useRouter();
  const progressFillRef = useRef<HTMLDivElement>(null);
  const [progressUi, setProgressUi] = useState<ProgressUi>(() => ({
    percent: status === 'completed' ? 100 : 0,
    stageLabel: status === 'completed' ? 'Show ready' : STAGES[0].label,
  }));

  useEffect(() => {
    const fallbackStartedAt = startedAt ? Date.parse(startedAt) : Date.now();
    const resolvedStartedAt = resolveGenerationStartedAt(
      persistKey,
      Number.isFinite(fallbackStartedAt) ? fallbackStartedAt : Date.now(),
    );
    let animationFrame = 0;
    let lastPercent: number | null = null;
    let lastStageLabel: string | null = null;

    const tick = () => {
      const elapsed = (Date.now() - resolvedStartedAt) / 1000;
      const nextProgress = status === 'completed' ? 1 : progressAtElapsed(elapsed, isWarm);
      const nextPercent = Math.round(nextProgress * 100);
      const nextStageLabel = status === 'completed' ? 'Show ready' : pickStage(nextProgress).label;

      progressFillRef.current?.style.setProperty('--progress-scale', String(nextProgress));

      if (nextPercent !== lastPercent || nextStageLabel !== lastStageLabel) {
        lastPercent = nextPercent;
        lastStageLabel = nextStageLabel;
        setProgressUi({ percent: nextPercent, stageLabel: nextStageLabel });
      }

      if (status === 'running') {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    tick();

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isWarm, persistKey, startedAt, status]);

  useEffect(() => {
    if (status !== 'running') return;
    const refresh = window.setInterval(() => router.refresh(), pollIntervalMs);
    return () => window.clearInterval(refresh);
  }, [router, status, pollIntervalMs]);

  useEffect(() => {
    if (status === 'completed') clearPersistedGenerationStart(persistKey);
  }, [status, persistKey]);

  const hint = isWarm ? 'Usually takes 20 to 30 seconds.' : 'Usually takes 1 to 2 minutes.';

  return (
    <section aria-label="Generating show" className={cn(styles.stage, className)}>
      <div className={styles.container} aria-hidden="true" />
      <div className={styles.overlay}>
        <div className={styles.card}>
          <div className={styles.panelTop}>
            <p className={styles.eyebrow}>Generating show</p>
            {showTitle ? <h1 className={styles.title}>{showTitle}</h1> : null}
            <div className={styles.stageLabelWrap} aria-live="polite">
              <p key={progressUi.stageLabel} className={styles.stageLabel}>
                {progressUi.stageLabel}
                {status === 'completed' ? '' : '…'}
              </p>
            </div>
          </div>
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
          <div className={styles.panelBottom}>
            <p className={styles.progressMeta}>
              <span className={styles.percent}>{progressUi.percent}%</span>
              <span className={styles.hint}>{hint}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
