/** Owns one optional audio element alongside the existing viewer lifecycle. */
'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Shot, Viewer } from '@showcrafter/fireworks/view';
import { soundtrackTransport } from './soundtrack-transport';
const MS_PER_SECOND = 1000; // Stored show offsets use milliseconds; audio uses seconds.

/** Mounts soundtrack audio after the viewer is ready; cleans it up on track change or unmount. */
export function useSoundtrack(
  viewer: RefObject<Viewer | null>,
  soundtrack: { url: string | undefined; offsetMs: number },
  shots: readonly Shot[],
  duration: number,
) {
  const { url, offsetMs } = soundtrack;
  const transport = useRef<ReturnType<typeof soundtrackTransport> | null>(null);
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    const current = viewer.current;
    if (url === undefined || url === '' || !current || duration === 0) return;
    const audio = new Audio(url);
    audio.preload = 'metadata';
    setFailure(undefined);
    const active = soundtrackTransport(
      current,
      audio,
      () => {
        setFailure('The soundtrack could not play. Try again or remove music to watch silently.');
      },
      offsetMs / MS_PER_SECOND,
    );
    transport.current = active;
    return () => {
      active.dispose();
      transport.current = null;
    };
  }, [viewer, url, offsetMs, shots, duration]);
  return { transport, failure: url !== undefined ? failure : undefined };
}
