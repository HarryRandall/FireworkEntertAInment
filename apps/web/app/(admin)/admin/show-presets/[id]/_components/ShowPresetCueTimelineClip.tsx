/** Draggable cue clip on the show preset timeline. */
'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { FireworkSpecification } from '@/lib/show-domain';
import { clamp, cn } from '@/lib/utils';
import {
  PX_PER_SECOND,
  MIN_CLIP_PX,
  TIMELINE_ROW_HEIGHT_PX,
  TIMELINE_ROW_GAP_PX,
  TIMELINE_INSET_PX,
  LocalCue,
  cueVisualSeconds,
  paletteOf,
  formatTimelineTimestamp,
} from './show-preset-model';

export function CueTimelineClip({
  cue,
  index,
  spec,
  duration,
  selected,
  onSelect,
  onMove,
}: {
  cue: LocalCue;
  index: number;
  spec: FireworkSpecification | undefined;
  duration: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (uid: string, seconds: number, commit: boolean) => void;
}) {
  const dragRef = useRef<{ startX: number; startTime: number; moved: boolean } | null>(null);
  const palette = paletteOf(spec);

  function timeFromPointer(clientX: number): number {
    const drag = dragRef.current;
    if (!drag) return cue.timeSeconds;
    return clamp(drag.startTime + (clientX - drag.startX) / PX_PER_SECOND, 0, duration);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startTime: cue.timeSeconds, moved: false };
    onSelect();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const movedPixels = event.clientX - drag.startX;
    if (Math.abs(movedPixels) > 3) drag.moved = true;
    if (!drag.moved) return;
    onMove(cue.uid, timeFromPointer(event.clientX), false);
  }

  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const finalTime = drag
      ? clamp(drag.startTime + (event.clientX - drag.startX) / PX_PER_SECOND, 0, duration)
      : cue.timeSeconds;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    if (drag?.moved) onMove(cue.uid, finalTime, true);
  }

  function cancelDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={cancelDrag}
      onDoubleClick={(event) => event.stopPropagation()}
      className={cn(
        'absolute z-10 flex cursor-grab touch-none items-center gap-2 overflow-hidden rounded-md border px-2 text-left text-xs font-medium text-white shadow-sm transition-[border-color,box-shadow] active:cursor-grabbing',
        selected ? 'border-white ring-2 ring-white/50' : 'border-white/15 hover:border-white/60',
      )}
      style={{
        left: cue.timeSeconds * PX_PER_SECOND,
        top:
          cue.launchPositionIndex * (TIMELINE_ROW_HEIGHT_PX + TIMELINE_ROW_GAP_PX) +
          TIMELINE_INSET_PX,
        width: Math.max(MIN_CLIP_PX, cueVisualSeconds(spec) * PX_PER_SECOND),
        height: TIMELINE_ROW_HEIGHT_PX - TIMELINE_INSET_PX * 2,
        background: `linear-gradient(90deg, ${palette.primary}, ${palette.secondary})`,
      }}
      title={`${formatTimelineTimestamp(cue.timeSeconds)} ${spec?.name ?? cue.description}`}
      aria-pressed={selected}
      aria-label={`${spec?.name ?? cue.description} at ${cue.timeSeconds.toFixed(1)} seconds`}
    >
      <span className="font-mono text-[10px] opacity-80">{index + 1}</span>
      <span className="truncate">{spec?.name ?? cue.description}</span>
    </button>
  );
}
