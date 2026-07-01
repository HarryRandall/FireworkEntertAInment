'use client';

/**
 * ShowPreviewPanel — the signature dark "night sky" preview surface that
 * wraps a live firework canvas with glassy show-control overlays: a live
 * title tile, music metadata, and a bottom transport bar with the energy
 * waveform and palette.
 *
 * The canvas is the production fireworks engine (`FireworkReplayCanvas`),
 * driven by a self-contained demo show (`DEMO_SHOW_CUES`) on a looping
 * clock. It is mounted immediately so fast scrolling never leaves a blank
 * preview frame.
 */
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { EnergyWaveform, PaletteDots } from './decor';
import { DEMO_SHOW_CUES, DEMO_SHOW_DURATION_SECONDS } from './demoShow';

const FireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((m) => m.FireworkReplayCanvas),
  { ssr: false, loading: () => null },
);

type ShowPreviewPanelProps = {
  height?: number;
  title?: string;
  theme?: string;
  palette?: string[];
};

const DURATION = DEMO_SHOW_DURATION_SECONDS;
const POSTER_TIME_SECONDS = 4;
const DISPLAY_UPDATE_INTERVAL_MS = 180;

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function ShowPreviewPanel({
  height = 460,
  title = 'Bohemian Rhapsody — Gold Finale',
  theme = `${DEMO_SHOW_CUES.length} cues · 6 drops · large yard`,
  palette = ['var(--show-gold)', 'var(--show-green)', 'var(--show-violet)'],
}: ShowPreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elapsedRef = useRef(POSTER_TIME_SECONDS);
  const playbackRef = useRef(POSTER_TIME_SECONDS);
  const startedAtRef = useRef<number | null>(null);
  const playheadStartRef = useRef(0);
  const lastDisplayUpdateRef = useRef(0);
  const [elapsed, setElapsed] = useState(POSTER_TIME_SECONDS);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    elapsedRef.current = elapsed;
    playbackRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const active = isCanvasReady && isInView && !isUserPaused && !reducedMotion;
  const previewStatus = reducedMotion ? 'Static rendered preview' : 'Live rendered preview';

  useEffect(() => {
    if (!active) {
      startedAtRef.current = null;
      setElapsed((current) =>
        Math.abs(current - elapsedRef.current) < 0.01 ? current : elapsedRef.current,
      );
      return;
    }
    let frame = 0;
    startedAtRef.current = performance.now();
    playheadStartRef.current = elapsedRef.current >= DURATION ? 0 : elapsedRef.current;
    elapsedRef.current = playheadStartRef.current;
    playbackRef.current = playheadStartRef.current;
    lastDisplayUpdateRef.current = 0;

    function tick(now: number) {
      if (startedAtRef.current == null) return;
      const next = playheadStartRef.current + (now - startedAtRef.current) / 1000;
      if (next >= DURATION) {
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
  }, [active]);

  const showCanvas = !reducedMotion;
  return (
    <div ref={containerRef} className="lp-sky-panel" style={{ height }}>
      <div className="lp-starfield" />

      {showCanvas ? (
        <div
          className={[
            'lp-sky-canvas',
            isCanvasReady ? 'lp-sky-canvas--ready' : 'lp-sky-canvas--loading',
          ].join(' ')}
        >
          <FireworkReplayCanvas
            cues={DEMO_SHOW_CUES}
            elapsed={elapsed}
            playbackRef={playbackRef}
            interactive={false}
            allowWheelZoom={false}
            controlsVisible={false}
            muted
            onReady={() => setIsCanvasReady(true)}
          />
        </div>
      ) : null}

      {/* top-left: live title */}
      <div className="lp-glass-tile absolute top-4 left-4 z-10 max-w-[62%] px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.04em] text-[var(--hl)]">
          <span className="lp-live-dot" /> 3D PREVIEW
        </div>
        <div className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-white">{title}</div>
        <div className="text-xs text-white/60">{theme}</div>
        <div className="mt-1 text-[11px] text-white/40">{previewStatus}</div>
      </div>

      {/* top-right: music meta */}
      <div className="lp-glass-tile absolute top-4 right-4 z-10 px-3 py-2.5 text-[11px] leading-relaxed text-white/80 tabular-nums">
        BPM 128
        <br />
        KEY F&#9839;m
      </div>

      {/* bottom transport bar */}
      <div className="lp-glass-tile absolute right-4 bottom-4 left-4 z-10 flex items-center gap-3.5 px-3.5 py-3">
        <button
          type="button"
          onClick={() => {
            if (reducedMotion) return;
            if (elapsedRef.current >= DURATION) {
              elapsedRef.current = 0;
              playbackRef.current = 0;
              setElapsed(0);
            } else if (active) {
              setElapsed(elapsedRef.current);
            }
            setIsUserPaused((paused) => !paused);
          }}
          aria-label={active ? 'Pause live preview' : 'Play live preview'}
          disabled={reducedMotion}
          className="text-stage-night inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {active ? (
            <Pause size={16} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={16} fill="currentColor" strokeWidth={0} />
          )}
        </button>
        <div className="min-w-0 flex-1 opacity-85">
          <EnergyWaveform height={26} palette={palette} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <PaletteDots palette={palette} />
          <span className="text-[11px] text-white/70 tabular-nums">
            {formatClock(elapsed)} · {DEMO_SHOW_CUES.length} cues
          </span>
        </div>
      </div>
    </div>
  );
}
