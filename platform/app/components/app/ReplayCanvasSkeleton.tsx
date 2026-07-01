'use client';

import { useEffect, useState } from 'react';
import {
  ReplayLoadingBar,
  type ReplayLoadingBarPosition,
} from '@/app/components/app/ReplayLoadingBar';
import { cn } from '@/lib/utils';
import { getCachedStagePoster, getStagePoster } from '@/lib/stage-poster-cache';

/**
 * Static "firework stage" placeholder shown the instant a card is hovered and
 * while the lazy Three.js replay canvas loads. It displays a real screenshot of
 * the empty replay scene (captured once from the actual renderer and cached, see
 * stage-poster-cache) so hovering reveals the true firework base immediately and
 * crossfades seamlessly into the live fireworks once they load. Until the
 * capture is ready it shows the scene's near-black backdrop, matching the sky.
 */
export function ReplayCanvasSkeleton({
  className,
  showLoadingBar = false,
  loadingBarPosition = 'bottom',
}: {
  className?: string;
  showLoadingBar?: boolean;
  loadingBarPosition?: ReplayLoadingBarPosition;
} = {}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (src) return;
    const cached = getCachedStagePoster();
    if (cached) {
      setSrc(cached);
      return;
    }

    let active = true;
    getStagePoster()
      .then((png) => {
        if (active) setSrc(png);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [src]);

  return (
    <div
      aria-hidden={showLoadingBar ? undefined : true}
      className={cn('absolute inset-0 h-full w-full overflow-hidden bg-[#020409]', className)}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      {showLoadingBar ? <ReplayLoadingBar progress={null} position={loadingBarPosition} /> : null}
    </div>
  );
}
