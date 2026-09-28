/** Multishot preview stage: the replay canvas with burst guides and transport. */
'use client';

import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { Repeat } from 'lucide-react';
import {
  PreviewFullscreenBackdrop,
  type PreviewFullscreenContainerProps,
} from '@/ui/firework-editor/previewFullscreen';
import { EditorPreviewTransport } from '@/ui/firework-editor/FireworkEditorShell';
import { ReplayCanvasSkeleton } from '@/ui/replay/ReplayCanvasSkeleton';
import type { AimMarker } from '@/ui/replay/FireworkReplayCanvas';
import type { ReplayCue } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import {
  SINGLE_MORTAR,
  PREVIEW_TRANSPORT_IDLE_MS,
  INSPECTOR_RENDER_OVERSCAN_PX,
} from './multishot-model';

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/ui/replay/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => <ReplayCanvasSkeleton /> },
);

export function PreviewStage({
  cues,
  elapsed,
  playbackRef,
  duration,
  fullWidth,
  isPlaying,
  isLooping,
  fullscreen,
  fullscreenContainerRef,
  fullscreenContainerProps,
  loading,
  loadingProgress,
  ticks,
  aimMarkers,
  selectedUid,
  onSelectMarker,
  onPlayPause,
  onReset,
  onLoopToggle,
  onFullscreenToggle,
  onExitFullscreen,
  onScrub,
  onPreviewLoadingProgress,
  onPreviewReady,
}: {
  cues: ReplayCue[];
  elapsed: number;
  playbackRef: MutableRefObject<number>;
  duration: number;
  fullWidth: boolean;
  isPlaying: boolean;
  isLooping: boolean;
  fullscreen: boolean;
  fullscreenContainerRef: RefObject<HTMLElement | null>;
  fullscreenContainerProps: PreviewFullscreenContainerProps;
  loading: boolean;
  loadingProgress: number | null;
  ticks: { timeSeconds: number; label: string }[];
  aimMarkers: AimMarker[];
  selectedUid: string | null;
  onSelectMarker: (id: string | null) => void;
  onPlayPause: () => void;
  onReset: () => void;
  onLoopToggle: () => void;
  onFullscreenToggle: () => void;
  onExitFullscreen: () => void;
  onScrub: (seconds: number) => void;
  onPreviewLoadingProgress: (progress: number | null) => void;
  onPreviewReady: () => void;
}) {
  const [transportActive, setTransportActive] = useState(true);
  const [previewActive, setPreviewActive] = useState(false);
  const transportIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transportVisible = previewActive && (!isPlaying || transportActive);
  const previewMenuActions = useMemo(
    () => [
      {
        id: 'loop',
        label: isLooping ? 'Disable looping' : 'Enable looping',
        active: isLooping,
        onClick: onLoopToggle,
        icon: <Repeat size={16} strokeWidth={2} />,
      },
    ],
    [isLooping, onLoopToggle],
  );

  const clearTransportIdleTimer = useCallback(() => {
    if (transportIdleTimer.current) {
      clearTimeout(transportIdleTimer.current);
      transportIdleTimer.current = null;
    }
  }, []);

  useEffect(() => {
    clearTransportIdleTimer();

    if (!isPlaying) {
      setTransportActive(true);
      return clearTransportIdleTimer;
    }

    setTransportActive(false);
    return clearTransportIdleTimer;
  }, [clearTransportIdleTimer, isPlaying]);

  function wakePreviewTransport() {
    setPreviewActive(true);
    clearTransportIdleTimer();

    if (!isPlaying) {
      setTransportActive(true);
      return;
    }

    setTransportActive(true);
    transportIdleTimer.current = setTimeout(
      () => setTransportActive(false),
      PREVIEW_TRANSPORT_IDLE_MS,
    );
  }

  function hidePreviewTransport() {
    setPreviewActive(false);
    setTransportActive(false);
    clearTransportIdleTimer();
  }

  function handlePreviewBlur(event: ReactFocusEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    hidePreviewTransport();
  }

  function handleTransportPlayPause() {
    if (!isPlaying) {
      setTransportActive(false);
      clearTransportIdleTimer();
    }
    onPlayPause();
  }

  return (
    <>
      <div className={fullscreen ? 'contents' : 'relative'}>
        <section
          data-preserve-shot-selection
          ref={fullscreenContainerRef}
          {...fullscreenContainerProps}
          onFocusCapture={wakePreviewTransport}
          onBlurCapture={handlePreviewBlur}
          onPointerEnter={wakePreviewTransport}
          onPointerDownCapture={wakePreviewTransport}
          onPointerMoveCapture={wakePreviewTransport}
          onPointerLeave={hidePreviewTransport}
          className={cn(
            'bg-stage-night border-border overflow-hidden rounded-lg border text-white',
            fullscreen
              ? 'fixed inset-[5vmin] z-[100] rounded-2xl border-white/12 shadow-[0_24px_60px_-20px_rgba(0,0,0,.85)]'
              : 'relative h-[560px]',
          )}
        >
          <div className="relative h-full w-full">
            <LazyFireworkReplayCanvas
              cues={cues}
              elapsed={elapsed}
              playbackRef={playbackRef}
              launchPositions={SINGLE_MORTAR}
              muted={!isPlaying}
              interactive
              controlsVisible={!loading}
              cameraMenuActions={previewMenuActions}
              primeSnapshots
              primeOnCueChanges={false}
              showLoadingBar
              renderOverscanPx={!fullscreen && !fullWidth ? INSPECTOR_RENDER_OVERSCAN_PX : 0}
              onPrimeProgress={onPreviewLoadingProgress}
              onReady={onPreviewReady}
              aimMarkers={aimMarkers}
              selectedMarkerId={selectedUid}
              onSelectMarker={onSelectMarker}
            />
            <div
              className={cn(
                'pointer-events-none absolute inset-x-0 bottom-5 z-30 transition-all duration-300',
                transportVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
              )}
            >
              <div className={transportVisible ? 'pointer-events-auto' : 'pointer-events-none'}>
                <EditorPreviewTransport
                  elapsed={elapsed}
                  duration={duration}
                  isPlaying={isPlaying}
                  fullscreen={fullscreen}
                  loading={loading}
                  loadingProgress={loadingProgress}
                  ticks={ticks}
                  onPlayPause={handleTransportPlayPause}
                  onReset={onReset}
                  onFullscreenToggle={onFullscreenToggle}
                  onScrub={onScrub}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
      {fullscreen ? <PreviewFullscreenBackdrop onExit={onExitFullscreen} /> : null}
    </>
  );
}
