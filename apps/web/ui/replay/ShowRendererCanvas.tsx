'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Viewer, setSetting } from '@showcrafter/renderer/view';
import { buildShowRendererShots } from '@/lib/shows/renderer-shots';
import type { ReplayCue, Show } from '@/lib/show-domain';
import { ReplayLoadingBar } from './ReplayLoadingBar';
import { Button } from '@/ui/patterns/Button';

/** Playback inputs shared by shows and catalogue previews, independent of the import canvas. */
type Props = {
  cues: ReplayCue[];
  elapsed: number;
  playbackRef?: MutableRefObject<number>;
  launchPositions?: Show['launchPositions'];
  prop?: 'mortar' | 'cake';
  muted?: boolean;
  scrubbing?: boolean;
  interactive?: boolean;
  controlsVisible?: boolean;
  showCameraControls?: boolean;
  cameraMenuActions?: { id: string; label: string; icon: ReactNode; onClick: () => void }[];
  cuesFinal?: boolean;
  onSceneReady?: () => void;
  onPrimeProgress?: (progress: number | null) => void;
  onReady?: () => void;
  showLoadingBar?: boolean;
  loadingBarPosition?: 'bottom' | 'center';
  allowFullscreen?: boolean;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  // Existing caller preferences retained while Viewer owns rendering and stateless seeks.
  compactPreview?: boolean;
  allowWheelZoom?: boolean;
  maxDevicePixelRatio?: number;
  antialias?: boolean;
  primeSnapshots?: boolean;
  primeOnCueChanges?: boolean;
  autoFrame?: boolean;
  preserveDrawingBuffer?: boolean;
  showFps?: boolean;
};
/** Drives stored-design playback from the parent transport clock. */
export function ShowRendererCanvas(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const shots = useMemo(
    () => buildShowRendererShots(props.cues, props.launchPositions),
    [props.cues, props.launchPositions],
  );

  useEffect(() => {
    if (!shots.ok) latest.current.onSceneReady?.();
  }, [shots]);

  useEffect(() => {
    if (!container.current || !shots.ok) return;
    setLoading(true);
    setError(null);
    let instance: Viewer;
    try {
      instance = new Viewer(container.current, {
        shots: shots.shots,
        ui: false,
        controls: props.interactive !== false,
        clickToPause: false,
        autoplay: false,
        loop: false,
        prop: props.prop,
      });
    } catch {
      setError('The firework viewer could not start. Please check WebGL support and reload.');
      latest.current.onSceneReady?.();
      setLoading(false);
      return;
    }
    viewer.current = instance;
    let frame = 0;
    let ready = false;
    let reported = false;
    const draw = () => {
      const current = latest.current;
      const time = Math.max(0, current.playbackRef?.current ?? current.elapsed);
      if (!ready && instance.renderer.domElement.dataset.drawPending === 'false') {
        ready = true;
        current.onSceneReady?.();
        current.onPrimeProgress?.(null);
      }
      if (ready && !reported && current.cuesFinal !== false) {
        reported = true;
        setLoading(false);
        current.onReady?.();
      }
      instance.syncTime(time, current.muted === false && !current.scrubbing);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      instance.dispose();
      viewer.current = null;
    };
  }, [shots, props.interactive, props.prop]);

  useEffect(() => {
    // Interactive players unlock on the first gesture; the external clock owns pause and mute.
    if (props.interactive !== false || props.muted === false) setSetting('sound', true);
  }, [props.muted, props.interactive]);

  return (
    <>
      <div
        ref={container}
        className="absolute inset-0 isolate overflow-hidden rounded-[inherit] bg-black"
      />
      {!shots.ok || error ? (
        <div
          role="alert"
          className="bg-background text-status-danger absolute inset-0 flex items-center justify-center p-4"
        >
          {shots.ok ? error : shots.error}
        </div>
      ) : null}
      {loading && shots.ok && !error && props.showLoadingBar !== false ? (
        <ReplayLoadingBar progress={null} position={props.loadingBarPosition ?? 'bottom'} />
      ) : null}
      {props.interactive !== false &&
      props.showCameraControls !== false &&
      props.controlsVisible !== false ? (
        <div className="absolute top-6 right-6 z-10 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => viewer.current?.resetCamera()}>
            Reset view
          </Button>
          {props.cameraMenuActions?.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant="secondary"
              aria-label={action.label}
              onClick={action.onClick}
            >
              {action.icon}
            </Button>
          ))}
          {props.allowFullscreen && props.onToggleFullscreen ? (
            <Button size="sm" variant="secondary" onClick={props.onToggleFullscreen}>
              {props.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
