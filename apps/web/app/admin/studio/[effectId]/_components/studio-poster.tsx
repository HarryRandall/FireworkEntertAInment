/** Thumbnails and looping hover frames use the renderer's single serial poster context. */
'use client';
import { useEffect, useRef, useState } from 'react';
import type { Design } from '@showcrafter/fireworks';
import { PosterAnimation } from './poster-animation';

/** Renders a still or a serial looping clip; cleanup ignores stale captures and cancels animation. */
export function StudioPoster({
  document,
  loop = false,
  climb = false,
  address = '',
}: {
  document: Design;
  loop?: boolean;
  climb?: boolean;
  address?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const animation = new PosterAnimation(target, document, { loop, climb, address }, setFailure);
    return () => {
      animation.dispose();
    };
  }, [document, loop, climb, address]);
  return (
    <div className="sc-studio-poster bg-stage">
      <canvas ref={canvas} aria-label="Firework preview" />
      {failure !== '' && <span role="status">{failure}</span>}
    </div>
  );
}
