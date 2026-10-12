'use client';
import { CanvasSurface } from '@/ui/renderer/CanvasSurface';

/**
 * ShowPreviewPanel is the dark "night sky" stage on the landing page: a live show on the
 * production renderer, with a song timeline along the bottom that visitors can scrub.
 *
 * The renderer mounts only as the panel approaches the viewport. The starfield stays
 * visible while its client chunk and WebGL context warm, so deferred loading does not
 * shift the page. Playback loops while the panel is on screen.
 */
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Music4 } from 'lucide-react';
import type { ReplayCue } from '@/lib/show-domain';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { AudioTimeline } from './AudioTimeline';
import { DEMO_TRACK_BPM, waveformPeaks } from './audioTrack';
import { PaletteDots } from './decor';
import { DEMO_SHOW_CUES, DEMO_SHOW_DURATION_SECONDS, cueMarkers } from './demoShow';
import styles from './landing.module.css';

const FireworkReplayCanvas = dynamic(
  () => import('@/ui/replay/ShowRendererCanvas').then((m) => m.ShowRendererCanvas),
  { ssr: false, loading: () => null },
);

type ShowPreviewPanelProps = {
  height?: number | string;
  cues?: ReplayCue[];
  duration?: number;
  title?: string;
  subtitle?: string;
  /** Names the song shown beside the timeline. */
  track?: string;
  palette?: string[];
  /** What one cue is called beside the count, such as shots for a cake. */
  unit?: string;
  /** Extra overlay in the top-right corner. */
  badge?: ReactNode;
};

const POSTER_TIME_SECONDS = 4;
const DISPLAY_UPDATE_INTERVAL_MS = 120;
const PREVIEW_RENDER_ROOT_MARGIN = '480px 0px';

export function ShowPreviewPanel({
  height = 460,
  cues = DEMO_SHOW_CUES,
  duration = DEMO_SHOW_DURATION_SECONDS,
  title = 'Gold Finale',
  subtitle = `${DEMO_SHOW_CUES.length} cues · 6 drops · large yard`,
  track = `Demo track · ${DEMO_TRACK_BPM} BPM`,
  palette = ['var(--show-gold)', 'var(--show-green)', 'var(--show-violet)'],
  unit = 'cues',
  badge,
}: ShowPreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const start = Math.min(POSTER_TIME_SECONDS, duration / 2);
  const elapsedRef = useRef(start);
  const playbackRef = useRef(start);
  const startedAtRef = useRef<number | null>(null);
  const playheadStartRef = useRef(0);
  const lastDisplayUpdateRef = useRef(0);
  const [elapsed, setElapsed] = useState(start);
  const [shouldMountCanvas, setShouldMountCanvas] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const peaks = useMemo(
    () =>
      waveformPeaks(
        duration,
        cues.map((cue) => cue.timeSeconds),
      ),
    [cues, duration],
  );
  const markers = useMemo(() => cueMarkers(cues), [cues]);

  const seek = useCallback((seconds: number) => {
    elapsedRef.current = seconds;
    playbackRef.current = seconds;
    playheadStartRef.current = seconds;
    if (startedAtRef.current !== null) startedAtRef.current = performance.now();
    setElapsed(seconds);
  }, []);

  // A new show starts from its beginning.
  const shownCues = useRef(cues);
  useEffect(() => {
    if (shownCues.current === cues) return;
    shownCues.current = cues;
    seek(0);
  }, [cues, seek]);

  useEffect(() => {
    if (shouldMountCanvas || reducedMotion) return;
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldMountCanvas(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldMountCanvas(true);
        observer.disconnect();
      },
      { rootMargin: PREVIEW_RENDER_ROOT_MARGIN, threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion, shouldMountCanvas]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(Boolean(entry?.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const active = isCanvasReady && isInView && !reducedMotion;
  const previewIsLoading = shouldMountCanvas && !isCanvasReady && !reducedMotion;
  const previewStatus = reducedMotion
    ? 'Animation disabled by reduced motion preference'
    : !shouldMountCanvas
      ? 'Preview loads as this section approaches'
      : !isCanvasReady
        ? 'Loading rendered preview…'
        : 'Live rendered preview';

  useEffect(() => {
    if (!active) {
      startedAtRef.current = null;
      return;
    }
    let frame = 0;
    startedAtRef.current = performance.now();
    playheadStartRef.current = elapsedRef.current >= duration ? 0 : elapsedRef.current;
    lastDisplayUpdateRef.current = 0;

    function tick(now: number) {
      if (startedAtRef.current == null) return;
      const next = playheadStartRef.current + (now - startedAtRef.current) / 1000;
      if (next >= duration) {
        startedAtRef.current = now;
        playheadStartRef.current = 0;
        elapsedRef.current = 0;
        playbackRef.current = 0;
        lastDisplayUpdateRef.current = now;
        setElapsed(0);
      } else {
        elapsedRef.current = next;
        playbackRef.current = next;
        if (now - lastDisplayUpdateRef.current >= DISPLAY_UPDATE_INTERVAL_MS) {
          lastDisplayUpdateRef.current = now;
          setElapsed(next);
        }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, duration]);

  const showCanvas = shouldMountCanvas && !reducedMotion;

  return (
    <div
      ref={containerRef}
      className={styles.skyPanel}
      style={{ height }}
      aria-busy={previewIsLoading || undefined}
    >
      <div className={styles.starfield} />

      {showCanvas ? (
        <div
          className={[
            styles.skyCanvas,
            isCanvasReady ? styles.skyCanvasReady : styles.skyCanvasLoading,
          ].join(' ')}
        >
          <CanvasSurface className="absolute inset-0">
            <FireworkReplayCanvas
              compactPreview
              cues={cues}
              lowPower="auto"
              elapsed={elapsed}
              playbackRef={playbackRef}
              playing={active}
              startDistance="farthest"
              interactive={false}
              allowWheelZoom={false}
              controlsVisible={false}
              muted
              onReady={() => setIsCanvasReady(true)}
            />
          </CanvasSurface>
        </div>
      ) : null}

      <div className={`${styles.glassTile} absolute top-4 left-4 z-10 max-w-[62%] px-3.5 py-2.5`}>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.04em] text-[var(--hl)]">
          <span
            aria-hidden="true"
            className={active ? styles.liveDot : 'h-[7px] w-[7px] rounded-full bg-white/35'}
          />{' '}
          3D PREVIEW
        </div>
        <div className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-white">{title}</div>
        <div className="text-xs text-white/60">{subtitle}</div>
        <div
          className="mt-1 text-[11px] text-white/40"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {previewStatus}
        </div>
      </div>

      {badge ? <div className="absolute top-4 right-4 z-10">{badge}</div> : null}

      <div
        className={`${styles.glassTile} absolute right-3 bottom-3 left-3 z-10 flex items-center gap-4 px-3.5 py-2.5 sm:right-4 sm:bottom-4 sm:left-4`}
      >
        <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-white/10">
            <Music4 aria-hidden="true" size={14} className="text-[var(--hl)]" />
          </span>
          <span className="max-w-36 truncate text-xs text-white/80">{track}</span>
        </div>
        <AudioTimeline
          peaks={peaks}
          markers={markers}
          duration={duration}
          elapsed={elapsed}
          onSeek={seek}
          label={`${title} timeline`}
          disabled={reducedMotion}
        />
        <div className="hidden flex-col items-end gap-1 md:flex">
          <PaletteDots palette={palette} />
          <span className="text-[11px] whitespace-nowrap text-white/60 tabular-nums">
            {cues.length} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}
