'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Pause, Play, Repeat, RotateCcw } from 'lucide-react';
import { formatDuration } from '@/lib/show-domain';
import { cn } from '@/lib/utils';

export type ReplayTransportTick = {
  timeSeconds: number;
  label: string;
};

type ReplayTransportControlsProps = {
  elapsed: number;
  duration: number;
  isPlaying: boolean;
  disabled?: boolean;
  ticks?: ReplayTransportTick[];
  isLooping?: boolean;
  fullscreen?: boolean;
  step?: number;
  className?: string;
  playLabel?: string;
  pauseLabel?: string;
  resetLabel?: string;
  timelineLabel?: string;
  loopOnLabel?: string;
  loopOffLabel?: string;
  fullscreenLabel?: string;
  exitFullscreenLabel?: string;
  onPlayPause: () => void;
  onReset: () => void;
  onLoopToggle?: () => void;
  onFullscreenToggle?: () => void;
  onScrub: (seconds: number) => void;
  onScrubEnd?: () => void;
};

export function ReplayTransportControls({
  elapsed,
  duration,
  isPlaying,
  disabled = false,
  ticks = [],
  isLooping,
  fullscreen = false,
  step = 0.05,
  className,
  playLabel = 'Play preview',
  pauseLabel = 'Pause preview',
  resetLabel = 'Restart preview',
  timelineLabel = 'Preview timeline',
  loopOnLabel = 'Disable looping',
  loopOffLabel = 'Enable looping',
  fullscreenLabel = 'Full screen',
  exitFullscreenLabel = 'Exit full screen',
  onPlayPause,
  onReset,
  onLoopToggle,
  onFullscreenToggle,
  onScrub,
  onScrubEnd,
}: ReplayTransportControlsProps) {
  const safeDuration = Math.max(0.1, duration);
  const scrubbingRef = useRef(false);
  const [localElapsed, setLocalElapsed] = useState(elapsed);

  useEffect(() => {
    if (!scrubbingRef.current) setLocalElapsed(elapsed);
  }, [elapsed]);

  const safeElapsed = Math.min(safeDuration, Math.max(0, localElapsed));
  const progress = (safeElapsed / safeDuration) * 100;
  const visibleTicks = ticks.filter(
    (tick) => tick.timeSeconds > 0 && tick.timeSeconds < safeDuration,
  );
  const hasLoop = typeof isLooping === 'boolean' && Boolean(onLoopToggle);
  const hasFullscreen = Boolean(onFullscreenToggle);

  function scrubTo(seconds: number) {
    if (disabled) return;
    const next = Math.min(safeDuration, Math.max(0, seconds));
    scrubbingRef.current = true;
    setLocalElapsed(next);
    onScrub(next);
  }

  function commitScrub() {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    onScrubEnd?.();
  }

  function jumpToTick(seconds: number) {
    scrubTo(seconds);
    scrubbingRef.current = false;
    onScrubEnd?.();
  }

  return (
    <div
      className={cn(
        'mx-auto flex w-[calc(100%_-_2rem)] max-w-[620px] items-center gap-2 rounded-xl border border-white/12 bg-black/55 px-4 py-3 text-white shadow-[var(--shadow-modal)] backdrop-blur-md',
        disabled && 'opacity-70',
        className,
      )}
    >
      <button
        type="button"
        onClick={onPlayPause}
        disabled={disabled}
        aria-label={isPlaying ? pauseLabel : playLabel}
        title={isPlaying ? pauseLabel : playLabel}
        className="focus-glow-action grid size-11 shrink-0 place-items-center rounded-full bg-white text-black shadow-[var(--shadow-cta)] transition hover:bg-white/90 focus:outline-none focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/40 disabled:shadow-none"
      >
        {isPlaying ? (
          <Pause size={17} strokeWidth={2.5} />
        ) : (
          <Play size={17} className="translate-x-0.5" fill="currentColor" strokeWidth={2.5} />
        )}
      </button>

      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        aria-label={resetLabel}
        title={resetLabel}
        className="focus-glow-action grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/12 focus:outline-none focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:text-white/35"
      >
        <RotateCcw size={15} strokeWidth={2} />
      </button>

      {hasLoop ? (
        <button
          type="button"
          onClick={onLoopToggle}
          disabled={disabled}
          aria-pressed={isLooping}
          aria-label={isLooping ? loopOnLabel : loopOffLabel}
          title={isLooping ? loopOnLabel : loopOffLabel}
          className={cn(
            'focus-glow-action grid size-10 shrink-0 place-items-center rounded-full border transition focus:outline-none focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:text-white/35',
            isLooping
              ? 'border-transparent bg-[color:var(--hl,#10b981)] text-black hover:brightness-110'
              : 'border-white/15 bg-white/6 text-white hover:bg-white/12',
          )}
        >
          <Repeat size={15} strokeWidth={2} />
        </button>
      ) : null}

      <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <span className="min-w-[2.55rem] text-right font-mono text-[11px] text-white/75 tabular-nums">
          {formatDuration(safeElapsed)}
        </span>
        <div className="relative flex h-7 min-w-0 items-center rounded-full outline-none select-none has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[color:var(--hl,#10b981)] has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-black">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/90" />
          <div
            className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-[color:var(--hl,#10b981)]"
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
          {visibleTicks.map((tick) => (
            <button
              key={`${tick.label}-${tick.timeSeconds}`}
              type="button"
              disabled={disabled}
              aria-label={`Jump to ${tick.label}`}
              onClick={() => jumpToTick(tick.timeSeconds)}
              className="group/tick pointer-events-auto absolute top-1/2 z-20 flex h-5 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hl,#10b981)] disabled:cursor-not-allowed"
              style={{ left: `${(tick.timeSeconds / safeDuration) * 100}%` }}
            >
              <span className="h-4 w-px rounded-full bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,.42)]" />
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-md border border-white/12 bg-black/90 px-2 py-1 text-[10px] leading-none font-semibold whitespace-nowrap text-white/90 opacity-0 shadow-[0_10px_24px_-14px_rgba(0,0,0,.9)] backdrop-blur-sm transition-opacity duration-150 group-hover/tick:opacity-100 group-focus-visible/tick:opacity-100">
                {tick.label}
              </span>
            </button>
          ))}
          <span
            className="absolute top-1/2 z-30 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[color:var(--hl,#10b981)] bg-white shadow-[0_1px_6px_rgba(0,0,0,.45)]"
            style={{ left: `${progress}%` }}
            aria-hidden="true"
          />
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={step}
            value={safeElapsed}
            disabled={disabled}
            onChange={(event) => scrubTo(Number(event.currentTarget.value))}
            onPointerUp={commitScrub}
            onPointerCancel={commitScrub}
            onKeyUp={commitScrub}
            onBlur={commitScrub}
            aria-label={timelineLabel}
            className="absolute inset-0 z-40 h-full w-full cursor-pointer opacity-0 focus:outline-none disabled:cursor-not-allowed"
          />
        </div>
        <span className="min-w-[2.55rem] font-mono text-[11px] text-white/75 tabular-nums">
          {formatDuration(safeDuration)}
        </span>
      </div>

      {hasFullscreen ? (
        <button
          type="button"
          onClick={onFullscreenToggle}
          disabled={disabled}
          aria-pressed={fullscreen}
          aria-label={fullscreen ? exitFullscreenLabel : fullscreenLabel}
          title={fullscreen ? exitFullscreenLabel : fullscreenLabel}
          className="focus-glow-action grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/12 focus:outline-none focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:text-white/35"
        >
          {fullscreen ? (
            <Minimize2 size={15} strokeWidth={2} />
          ) : (
            <Maximize2 size={15} strokeWidth={2} />
          )}
        </button>
      ) : null}
    </div>
  );
}
