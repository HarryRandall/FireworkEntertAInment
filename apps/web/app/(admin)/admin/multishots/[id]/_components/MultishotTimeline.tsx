/** Multishot timeline tracks and draggable shot clips. */
'use client';

import {
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Film, Layers3, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { Badge } from '@/ui/patterns/Badge';
import { Button } from '@/ui/patterns/Button';
import {
  MULTISHOT_MAX_SHOT_COUNT,
  MULTISHOT_MAX_TRACK_COUNT,
} from '@/lib/admin/multishot-constraints';
import type { FireworkSpecification } from '@/lib/show-domain';
import { formatDuration } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import {
  PX_PER_SECOND,
  MIN_CLIP_PX,
  TIMELINE_TRACK_HEIGHT_PX,
  TIMELINE_TRACK_LABEL_WIDTH_PX,
  TIMELINE_CLIP_INSET_PX,
  LocalShot,
  fireworkDurationOf,
  clipPaletteOf,
  formatSecondsLabel,
  formatTimelineTimestamp,
} from './multishot-model';

export function Timeline({
  shots,
  specsById,
  duration,
  elapsed,
  selectedUid,
  trackCount,
  disabled,
  addDisabled,
  onSelect,
  onSeek,
  onMoveShot,
  onAdd,
  onAddTrack,
}: {
  shots: LocalShot[];
  specsById: Map<string, FireworkSpecification>;
  duration: number;
  elapsed: number;
  selectedUid: string | null;
  trackCount: number;
  disabled: boolean;
  addDisabled: boolean;
  onSelect: (uid: string) => void;
  onSeek: (seconds: number) => void;
  onMoveShot: (uid: string, seconds: number, commit: boolean) => void;
  onAdd: (trackIndex: number) => void;
  onAddTrack: () => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const width = Math.max(1, duration) * PX_PER_SECOND;
  const seconds = Array.from({ length: Math.floor(duration) + 1 }, (_, index) => index);
  const tracks = Array.from({ length: trackCount }, (_, index) => index);
  const shotsByTrack = useMemo(() => {
    const grouped = new Map<number, LocalShot[]>();
    for (const shot of shots) {
      const trackShots = grouped.get(shot.timelineTrackIndex) ?? [];
      trackShots.push(shot);
      grouped.set(shot.timelineTrackIndex, trackShots);
    }
    for (const trackShots of grouped.values()) {
      trackShots.sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    }
    return grouped;
  }, [shots]);
  const scrubElapsed = Math.max(0, Math.min(duration, elapsed));
  const selectedTrackIndex =
    shots.find((shot) => shot.uid === selectedUid)?.timelineTrackIndex ?? 0;

  function seekFromValue(value: string) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    onSeek(Math.max(0, Math.min(duration, next)));
  }

  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Film size={16} className="text-muted-foreground" />
            <h2 className="text-foreground text-sm font-semibold">Timeline</h2>
            <Badge tone="neutral" solid icon={null} className="font-mono tabular-nums">
              {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Drag clips horizontally to change firing time. Tracks only change through the shot
            inspector.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onAddTrack}
            disabled={trackCount >= MULTISHOT_MAX_TRACK_COUNT}
          >
            <Layers3 size={15} />
            Add track
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => onAdd(selectedTrackIndex)}
            disabled={addDisabled}
            title={
              addDisabled && !disabled
                ? `A multishot can contain up to ${MULTISHOT_MAX_SHOT_COUNT.toLocaleString()} shots.`
                : `Add a shot to Track ${selectedTrackIndex + 1}`
            }
          >
            <Plus size={15} />
            Add shot
          </Button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="border-border relative max-h-[420px] [scrollbar-gutter:stable] overflow-auto rounded-md border"
      >
        <div
          className="relative min-w-full"
          style={{ width: TIMELINE_TRACK_LABEL_WIDTH_PX + width }}
        >
          <div className="border-border bg-card sticky top-0 z-30 flex h-7 border-b">
            <div
              className="border-border bg-card text-muted-foreground sticky left-0 z-40 flex shrink-0 items-center border-r px-3 text-[10px] font-medium uppercase"
              style={{ width: TIMELINE_TRACK_LABEL_WIDTH_PX }}
            >
              Tracks
            </div>
            <div
              className="relative shrink-0 cursor-ew-resize touch-none select-none"
              style={{ width }}
            >
              {seconds.map((second) => (
                <div
                  key={second}
                  className="absolute top-0 flex h-full flex-col justify-between"
                  style={{ left: second * PX_PER_SECOND }}
                >
                  <span className="text-muted-foreground pointer-events-none -translate-x-1 pl-1 font-mono text-[10px] tabular-nums">
                    {formatDuration(second)}
                  </span>
                  <span className="bg-border-emphasis h-1.5 w-px" />
                </div>
              ))}
              <input
                type="range"
                min={0}
                max={duration}
                step={0.01}
                value={scrubElapsed}
                disabled={disabled}
                aria-label="Multishot preview time"
                aria-valuetext={formatTimelineTimestamp(scrubElapsed)}
                className="absolute inset-0 z-30 m-0 h-full w-full cursor-ew-resize touch-none appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
                onChange={(event) => seekFromValue(event.currentTarget.value)}
              />
            </div>
          </div>

          {tracks.map((trackIndex) => {
            const trackShots = shotsByTrack.get(trackIndex) ?? [];
            return (
              <div
                key={trackIndex}
                className="border-border flex border-b last:border-b-0"
                style={{
                  height: TIMELINE_TRACK_HEIGHT_PX,
                  contentVisibility: 'auto',
                  containIntrinsicSize: `auto ${TIMELINE_TRACK_HEIGHT_PX}px`,
                }}
              >
                <div
                  className="border-border bg-card sticky left-0 z-20 flex shrink-0 items-center justify-between gap-1 border-r px-2"
                  style={{ width: TIMELINE_TRACK_LABEL_WIDTH_PX }}
                >
                  <span className="text-foreground min-w-0 truncate font-mono text-[11px] font-medium tabular-nums">
                    Track {trackIndex + 1}
                  </span>
                  <button
                    type="button"
                    data-preserve-shot-selection
                    onClick={() => onAdd(trackIndex)}
                    disabled={addDisabled}
                    aria-label={`Add shot to Track ${trackIndex + 1}`}
                    className="focus-visible:ring-ring/50 text-muted-foreground hover:bg-secondary hover:text-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <div
                  className="relative shrink-0"
                  style={{
                    width,
                    backgroundImage:
                      'linear-gradient(to right, var(--color-border-subtle) 1px, transparent 1px)',
                    backgroundSize: `${PX_PER_SECOND}px 100%`,
                  }}
                >
                  {trackShots.length === 0 ? (
                    <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[10px]">
                      Empty track
                    </span>
                  ) : null}
                  {trackShots.map((shot) => (
                    <ShotClip
                      key={shot.uid}
                      shot={shot}
                      spec={specsById.get(shot.fireworkId)}
                      duration={duration}
                      selected={shot.uid === selectedUid}
                      onSelect={() => onSelect(shot.uid)}
                      onMove={onMoveShot}
                    />
                  ))}
                  <div
                    className="bg-primary pointer-events-none absolute top-0 bottom-0 z-10 w-px"
                    style={{ left: scrubElapsed * PX_PER_SECOND }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ShotClip({
  shot,
  spec,
  duration,
  selected,
  onSelect,
  onMove,
}: {
  shot: LocalShot;
  spec: FireworkSpecification | undefined;
  duration: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (uid: string, seconds: number, commit: boolean) => void;
}) {
  const dragRef = useRef<{ startX: number; startOffset: number; moved: boolean } | null>(null);
  const left = shot.timeOffsetSeconds * PX_PER_SECOND;
  const clipDuration = fireworkDurationOf(spec);
  const clipWidth = Math.max(MIN_CLIP_PX, clipDuration * PX_PER_SECOND);
  const { primary, secondary } = clipPaletteOf(spec);

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startOffset: shot.timeOffsetSeconds, moved: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    if (Math.abs(dx) > 3) drag.moved = true;
    const next = Math.max(0, Math.min(duration, drag.startOffset + dx / PX_PER_SECOND));
    onMove(shot.uid, Number(next.toFixed(2)), false);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag) return;
    if (drag.moved) {
      const dx = event.clientX - drag.startX;
      const next = Math.max(0, Math.min(duration, drag.startOffset + dx / PX_PER_SECOND));
      onMove(shot.uid, Number(next.toFixed(2)), true);
    } else {
      onSelect();
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const step = event.shiftKey ? 1 : 0.1;
    const next = Math.max(0, Math.min(duration, shot.timeOffsetSeconds + direction * step));
    onMove(shot.uid, Number(next.toFixed(2)), true);
    onSelect();
  }

  return (
    <button
      type="button"
      data-preserve-shot-selection
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        'group absolute z-10 flex cursor-grab touch-none flex-col justify-between overflow-hidden rounded-md border px-2 py-1 text-left transition-[border-color,box-shadow,transform] active:cursor-grabbing',
        selected
          ? 'z-20 border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.65),0_0_22px_rgba(255,255,255,0.18)]'
          : 'border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:border-white/45 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_16px_rgba(255,255,255,0.08)]',
      )}
      style={{
        left,
        top: TIMELINE_CLIP_INSET_PX,
        height: TIMELINE_TRACK_HEIGHT_PX - TIMELINE_CLIP_INSET_PX * 2,
        width: clipWidth,
        background: `linear-gradient(135deg, color-mix(in srgb, ${primary} 72%, #050505), color-mix(in srgb, ${secondary} 58%, #050505))`,
      }}
      aria-pressed={selected}
      aria-label={`${spec?.name ?? 'Shot'} on Track ${shot.timelineTrackIndex + 1} at ${shot.timeOffsetSeconds.toFixed(1)} seconds`}
    >
      <span className="min-w-0 truncate text-[10px] leading-none font-semibold text-white drop-shadow">
        {spec?.name ?? 'Unknown firework'}
        <span className="font-mono font-medium text-white/78">
          {' '}
          ({formatSecondsLabel(clipDuration)})
        </span>
      </span>
      <span className="flex items-center gap-1 font-mono text-[9px] leading-none text-white/78 tabular-nums">
        {shot.saveState === 'saving' ? (
          <Loader2 size={10} className="animate-spin" />
        ) : shot.saveState === 'error' ? (
          <TriangleAlert size={10} className="text-status-danger" />
        ) : null}
        {formatTimelineTimestamp(shot.timeOffsetSeconds)}
      </span>
    </button>
  );
}
