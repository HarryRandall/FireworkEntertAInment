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
import type { ReplayCue } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import { PREVIEW_TRANSPORT_IDLE_MS } from './multishot-model';

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/ui/replay/ShowRendererCanvas').then((mod) => mod.ShowRendererCanvas),
  { ssr: false, loading: () => <ReplayCanvasSkeleton /> },
);

export function PreviewStage({
  cues,
  elapsed,
  playbackRef,
  duration,
  isPlaying,
  isLooping,
  fullscreen,
  fullscreenContainerRef,
  fullscreenContainerProps,
  loading,
  loadingProgress,
  ticks,
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
  isPlaying: boolean;
  isLooping: boolean;
  fullscreen: boolean;
  fullscreenContainerRef: RefObject<HTMLElement | null>;
  fullscreenContainerProps: PreviewFullscreenContainerProps;
  loading: boolean;
  loadingProgress: number | null;
  ticks: { timeSeconds: number; label: string }[];
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
              prop="cake"
              cues={cues}
              elapsed={elapsed}
              playbackRef={playbackRef}
              muted={!isPlaying}
              interactive
              controlsVisible={!loading}
              cameraMenuActions={previewMenuActions}
              showLoadingBar
              onPrimeProgress={onPreviewLoadingProgress}
              onReady={onPreviewReady}
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
                  isLooping={isLooping}
                  onLoopToggle={onLoopToggle}
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
