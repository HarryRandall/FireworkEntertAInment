'use client';

/**
 * A song waveform with the show's cues marked along it. The played part is bright, and
 * dragging, clicking or the arrow keys move the playhead.
 */
import { useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { formatClock } from './audioTrack';

export type TimelineMarker = { time: number; color: string };

// SVG user units: the waveform is drawn in a fixed box and stretched to the track.
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 40;
const BAR_SHARE = 0.62;
const MIN_BAR = 2;
/** Seconds moved by one arrow key press. */
const KEY_STEP_SECONDS = 1;

export function AudioTimeline({
  peaks,
  markers,
  duration,
  elapsed,
  onSeek,
  label,
  disabled = false,
}: {
  peaks: readonly number[];
  markers: readonly TimelineMarker[];
  duration: number;
  elapsed: number;
  onSeek: (seconds: number) => void;
  /** Names the slider for assistive technology. */
  label: string;
  disabled?: boolean;
}) {
  const clipId = useId();
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0;
  const step = VIEW_WIDTH / peaks.length;

  function seekToPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const share = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(share * duration);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? elapsed + KEY_STEP_SECONDS
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? elapsed - KEY_STEP_SECONDS
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? duration
              : null;
    if (next === null) return;
    event.preventDefault();
    onSeek(Math.min(duration, Math.max(0, next)));
  }

  const bars = peaks.map((peak, index) => {
    const height = Math.max(MIN_BAR, peak * VIEW_HEIGHT);
    return (
      <rect
        key={index}
        x={index * step + (step * (1 - BAR_SHARE)) / 2}
        y={(VIEW_HEIGHT - height) / 2}
        width={step * BAR_SHARE}
        height={height}
        rx={step * BAR_SHARE * 0.5}
      />
    );
  });

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 text-[11px] text-white/70 tabular-nums">
      <span className="w-8 text-right">{formatClock(elapsed)}</span>
      <div
        ref={track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(elapsed)}
        aria-valuetext={`${formatClock(elapsed)} of ${formatClock(duration)}`}
        aria-disabled={disabled || undefined}
        className="group relative h-10 min-w-0 flex-1 cursor-pointer touch-none rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--hl)] focus-visible:outline-none aria-disabled:cursor-default"
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          seekToPointer(event);
        }}
        onPointerMove={(event) => {
          if (dragging.current) seekToPointer(event);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={disabled ? undefined : onKeyDown}
      >
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={0} width={progress * VIEW_WIDTH} height={VIEW_HEIGHT} />
            </clipPath>
          </defs>
          <g fill="rgb(255 255 255 / 0.22)">{bars}</g>
          <g fill="rgb(255 255 255 / 0.92)" clipPath={`url(#${clipId})`}>
            {bars}
          </g>
        </svg>
        {markers.map((marker, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="absolute -top-1.5 size-1.5 -translate-x-1/2 rounded-full"
            style={{
              left: `${(marker.time / duration) * 100}%`,
              backgroundColor: marker.color,
              opacity: marker.time <= elapsed ? 1 : 0.45,
            }}
          />
        ))}
        <span
          aria-hidden="true"
          className="absolute -inset-y-1 w-px bg-[var(--hl)] shadow-[0_0_8px_var(--hl)]"
          style={{ left: `${progress * 100}%` }}
        />
      </div>
      <span className="w-8">{formatClock(duration)}</span>
    </div>
  );
}
