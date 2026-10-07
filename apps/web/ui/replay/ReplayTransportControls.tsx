'use client';

/** Consumer replay presentation and transport integration. */

import { type MutableRefObject, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Pause, Play, Repeat, RotateCcw } from 'lucide-react';
import { playbackReadoutGate } from '@/ui/renderer/playback-readout';
import { formatDuration } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/patterns/Button';
import { Slider } from '@/ui/primitives/slider';

export type ReplayTransportTick = {
  timeSeconds: number;
  label: string;
};

type ReplayTransportControlsProps = {
  elapsed: number;
  /**
   * Optional live playhead ref (same ref the engine reads). When provided,
   * the thumb and time readout sample it at the transport readout cadence while
   * playing, so the parent can throttle its `elapsed` state without the
   * transport UI losing sync.
   */
  playheadRef?: MutableRefObject<number>;
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

/** Responsive transport with a full-width mobile timeline. */
export function ReplayTransportControls({
  elapsed,
  playheadRef,
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
  const selfAnimated = playheadRef != null && isPlaying;

  useEffect(() => {
    // While self-animating, the RAF below owns localElapsed; syncing the
    // throttled prop on top would step the thumb backwards between frames.
    if (!scrubbingRef.current && !selfAnimated) setLocalElapsed(elapsed);
  }, [elapsed, selfAnimated]);

  // Keep the transport clock in sync without a React update on every display frame.
  useEffect(() => {
    if (!selfAnimated || !playheadRef) return;
    let frame = 0;
    const playhead = playheadRef;
    const readout = playbackReadoutGate();
    function tick(nowMs: number) {
      if (
        !scrubbingRef.current &&
        readout({ time: playhead.current, duration, playing: true }, nowMs)
      )
        setLocalElapsed(playhead.current);
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [selfAnimated, playheadRef, duration]);

  const safeElapsed = Math.min(safeDuration, Math.max(0, localElapsed));
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
        'border-border bg-card/90 text-foreground mx-auto flex w-[calc(100%_-_2rem)] max-w-[620px] flex-wrap items-center gap-2 rounded-xl border px-4 py-3 shadow-[var(--shadow-modal)] backdrop-blur-md sm:flex-nowrap',
        disabled && 'opacity-70',
        className,
      )}
    >
      <Button
        type="button"
        onClick={onPlayPause}
        disabled={disabled}
        aria-label={isPlaying ? pauseLabel : playLabel}
        title={isPlaying ? pauseLabel : playLabel}
        className="size-8 shrink-0 p-0"
      >
        {isPlaying ? (
          <Pause size={17} strokeWidth={2.5} />
        ) : (
          <Play size={17} className="translate-x-0.5" fill="currentColor" strokeWidth={2.5} />
        )}
      </Button>

      <Button
        type="button"
        onClick={onReset}
        disabled={disabled}
        aria-label={resetLabel}
        title={resetLabel}
        className="size-8 shrink-0 p-0"
      >
        <RotateCcw size={15} strokeWidth={2} />
      </Button>

      {hasLoop ? (
        <Button
          type="button"
          onClick={onLoopToggle}
          disabled={disabled}
          aria-pressed={isLooping}
          aria-label={isLooping ? loopOnLabel : loopOffLabel}
          title={isLooping ? loopOnLabel : loopOffLabel}
          className={cn('size-8 shrink-0 p-0', isLooping && 'bg-primary text-primary-foreground')}
        >
          <Repeat size={15} strokeWidth={2} />
        </Button>
      ) : null}

      <div className="order-first grid min-w-0 flex-1 basis-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:order-none sm:basis-auto sm:gap-3">
        <span className="text-muted-foreground min-w-[2.55rem] text-right font-mono text-[11px] tabular-nums">
          {formatDuration(safeElapsed)}
        </span>
        <div className="relative min-w-0 py-2">
          <Slider
            min={0}
            max={safeDuration}
            step={step}
            value={[safeElapsed]}
            disabled={disabled}
            onValueChange={([seconds]) => scrubTo(seconds)}
            onValueCommit={commitScrub}
            aria-label={timelineLabel}
          />
          {visibleTicks.map((tick) => (
            <Button
              key={`${tick.label}-${tick.timeSeconds}`}
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              aria-label={`Jump to ${tick.label}`}
              onClick={() => jumpToTick(tick.timeSeconds)}
              className="absolute top-full h-2 w-3 -translate-x-1/2 p-0"
              style={{ left: `${(tick.timeSeconds / safeDuration) * 100}%` }}
            >
              <span className="bg-muted-foreground h-2 w-px" />
            </Button>
          ))}
        </div>
        <span className="text-muted-foreground min-w-[2.55rem] font-mono text-[11px] tabular-nums">
          {formatDuration(safeDuration)}
        </span>
      </div>

      {hasFullscreen ? (
        <Button
          type="button"
          onClick={onFullscreenToggle}
          disabled={disabled}
          aria-pressed={fullscreen}
          aria-label={fullscreen ? exitFullscreenLabel : fullscreenLabel}
          title={fullscreen ? exitFullscreenLabel : fullscreenLabel}
          className="size-8 shrink-0 p-0"
        >
          {fullscreen ? (
            <Minimize2 size={15} strokeWidth={2} />
          ) : (
            <Maximize2 size={15} strokeWidth={2} />
          )}
        </Button>
      ) : null}
    </div>
  );
}
