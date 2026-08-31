'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ReplayLoadingBar } from './ReplayLoadingBar';
import { ReplayStageBackdrop } from './ReplayStageBackdrop';

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/components/replay/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => null,
  },
);

/**
 * Route fallback for replay previews. It starts the real WebGL canvas module
 * immediately with an empty stage, then keeps the shared loading bar visible
 * until the route swaps to the actual show replay.
 */
export function ReplayPanelLoadingStage({ className }: { className?: string }) {
  const [sceneReady, setSceneReady] = useState(false);

  return (
    <div
      className={cn('absolute inset-0 overflow-hidden rounded-[inherit] bg-[#020409]', className)}
    >
      <ReplayStageBackdrop
        className={cn('transition-opacity duration-500', sceneReady && 'opacity-0')}
      />
      <LazyFireworkReplayCanvas
        cues={[]}
        elapsed={0}
        muted
        interactive={false}
        controlsVisible={false}
        showCameraControls={false}
        showLoadingBar={false}
        cuesFinal={false}
        maxDevicePixelRatio={1}
        onSceneReady={() => setSceneReady(true)}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.36)_100%)]" />
      <ReplayLoadingBar progress={null} position="bottom" />
    </div>
  );
}
