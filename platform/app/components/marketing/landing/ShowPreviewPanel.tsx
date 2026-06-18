'use client';

/**
 * ShowPreviewPanel — the signature dark "night sky" preview surface that
 * wraps a live firework canvas with glassy show-control overlays: a live
 * title tile, music metadata, and a bottom transport bar with the energy
 * waveform and palette.
 *
 * The canvas is the production fireworks engine (`FireworkReplayCanvas`),
 * driven by a self-contained demo show (`DEMO_SHOW_CUES`) on a looping
 * clock. It is mounted lazily and only animates while on-screen.
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
  const elapsedRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const playheadStartRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    elapsedRef.current = elapsed;
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
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: '120px', threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const active = isPlaying && isVisible && !reducedMotion;

  useEffect(() => {
    if (!active) {
      startedAtRef.current = null;
      return;
    }
    let frame = 0;
    startedAtRef.current = performance.now();
    playheadStartRef.current = elapsedRef.current >= DURATION ? 0 : elapsedRef.current;

    function tick(now: number) {
      if (startedAtRef.current == null) return;
      const next = playheadStartRef.current + (now - startedAtRef.current) / 1000;
      if (next >= DURATION) {
        startedAtRef.current = now;
        playheadStartRef.current = 0;
        setElapsed(0);
      } else {
        setElapsed(next);
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div ref={containerRef} className="lp-sky-panel" style={{ height }}>
      {isVisible ? (
        <div className="lp-sky-canvas cursor-grab active:cursor-grabbing">
          <FireworkReplayCanvas
            cues={DEMO_SHOW_CUES}
            elapsed={elapsed}
            interactive
            controlsVisible={false}
            muted
          />
        </div>
      ) : (
        <div className="lp-starfield" />
      )}

      {/* top-left: live title */}
      <div className="lp-glass-tile absolute top-4 left-4 z-10 max-w-[62%] px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.04em] text-[var(--hl)]">
          <span className="lp-live-dot" /> LIVE PREVIEW
        </div>
        <div className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-white">{title}</div>
        <div className="text-xs text-white/60">{theme}</div>
        <div className="mt-1 text-[11px] text-white/40">Drag to look around</div>
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
            if (elapsedRef.current >= DURATION) setElapsed(0);
            setIsPlaying((playing) => !playing);
          }}
          aria-label={isPlaying ? 'Pause live preview' : 'Play live preview'}
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#09090b] transition-transform active:scale-95"
        >
          {isPlaying ? (
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
