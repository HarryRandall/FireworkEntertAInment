/** A local reference clip that follows the preview's play, pause and scrub. */
'use client';
import { useEffect, useRef, useState } from 'react';
import type { Viewer } from '@showcrafter/renderer/view';
import { referenceTime, type ReferenceClip } from '@/lib/renderer-editor/reference';

const SYNC_TOLERANCE_S = 0.08; // Seconds: correct drift beyond about two phone video frames.

/** Seeks the clip on every viewer change and plays it while the preview plays. */
export function ReferenceVideo({ clip, viewer }: { clip: ReferenceClip; viewer: Viewer | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    const element = video.current;
    if (!viewer || !element) return;
    const sync = () => {
      if (!Number.isFinite(element.duration)) return;
      const target = referenceTime(viewer.t, element.duration, clip.offsetS);
      if (!viewer.playing || Math.abs(element.currentTime - target) > SYNC_TOLERANCE_S)
        element.currentTime = target;
      if (viewer.playing && target < element.duration) {
        if (element.paused)
          void element.play().catch((error: unknown) => {
            // A seek, pause or clip change can deliberately interrupt pending playback.
            if (error instanceof DOMException && error.name === 'AbortError') return;
            setFailure('The clip could not play. Use the scrubber or choose another clip.');
          });
      } else element.pause();
    };
    const unsubscribe = viewer.on(sync);
    element.addEventListener('loadedmetadata', sync);
    sync();
    return () => {
      unsubscribe();
      element.pause();
      element.removeEventListener('loadedmetadata', sync);
    };
  }, [viewer, clip.url, clip.offsetS]);
  return (
    <figure className="relative h-full min-h-0 bg-black">
      <video
        ref={video}
        src={clip.url}
        muted
        playsInline
        preload="auto"
        aria-label={`Reference clip: ${clip.name}`}
        className="h-full w-full object-contain"
        onError={() => setFailure('This clip could not be decoded. Choose another video.')}
      />
      <figcaption className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
        Reference
      </figcaption>
      {failure && (
        <p
          role="alert"
          className="text-status-danger absolute inset-x-2 bottom-16 bg-black/70 p-2 text-xs"
        >
          {failure}
        </p>
      )}
    </figure>
  );
}
