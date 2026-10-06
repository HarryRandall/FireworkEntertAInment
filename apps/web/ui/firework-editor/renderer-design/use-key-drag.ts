/** Pointer capture lifecycle shared by authored key editors. */
'use client';
import { useRef, type PointerEvent } from 'react';

/** Tracks a key index during a captured pointer gesture; cancellation and lost capture end editing. */
export function useKeyDrag(onMove: (event: PointerEvent<HTMLElement>, index: number) => void) {
  const active = useRef<number | null>(null);
  function start(event: PointerEvent<HTMLElement>, index: number) {
    active.current = index;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (active.current !== null) {
      onMove(event, active.current);
    }
  }
  function end() {
    active.current = null;
  }
  return { start, move, end };
}
