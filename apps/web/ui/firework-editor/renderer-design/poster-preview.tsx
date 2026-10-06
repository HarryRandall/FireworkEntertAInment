'use client';

import { CanvasSurface } from '@/ui/renderer/CanvasSurface';

import { useEffect, useRef, useState } from 'react';
import type { Design } from '@showcrafter/renderer';
import { poster } from '@showcrafter/renderer/poster';

// CSS pixels: match the renderer's default 16:10 thumbnail surface.
const HOVER_POSTER_WIDTH_PX = 320;
const HOVER_POSTER_HEIGHT_PX = 200;

/** Commits a shared-surface still only while this preview owns the destination canvas. */
export function PosterPreview({ document }: { document: Design }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailure(false);
    const destination = canvas.current;
    // Copy into a detached canvas first so an obsolete asynchronous render cannot
    // overwrite the next option's poster on the visible canvas.
    const staging = window.document.createElement('canvas');
    void poster(staging, document, {
      width: HOVER_POSTER_WIDTH_PX,
      height: HOVER_POSTER_HEIGHT_PX,
    })
      .then(() => {
        if (cancelled || !destination) return;
        destination.width = staging.width;
        destination.height = staging.height;
        destination.getContext('2d')?.drawImage(staging, 0, 0);
      })
      .catch(() => {
        if (!cancelled) setFailure(true);
      });
    return () => {
      cancelled = true;
    };
  }, [document]);
  return (
    <CanvasSurface className="bg-stage-night aspect-[16/10] w-full rounded-md">
      <canvas ref={canvas} aria-hidden className="h-full w-full" />
      {failure && (
        <p role="status" className="text-status-danger absolute inset-0 p-3 text-xs">
          Preview unavailable
        </p>
      )}
    </CanvasSurface>
  );
}
