'use client';

/** Consumer replay presentation and transport integration. */

import { viewerReadiness } from '@/ui/renderer/viewer-readiness';
import { visibleClock } from '@/ui/renderer/visible-clock';
import { CanvasSurface } from '@/ui/renderer/CanvasSurface';

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Viewer, setSetting } from '@showcrafter/renderer/view';
import { buildShowRendererShots } from '@/lib/shows/renderer-shots';
import type { ReplayCue, Show } from '@/lib/show-domain';
import { ReplayLoadingBar } from './ReplayLoadingBar';
import { Button } from '@/ui/patterns/Button';
import { ReplayViewerSettings, ReplayViewerStats } from './ReplayViewerSettings';

// Whole shows need a little additional space around the automatic audience fit.
const SHOW_FRAMING_DISTANCE_SCALE = 1.1;

/** Playback inputs shared by shows and catalogue previews, independent of the import canvas. */
type Props = {
  cues: ReplayCue[];
  showStaging?: boolean;
  elapsed: number;
  playbackRef?: MutableRefObject<number>;
  launchPositions?: Show['launchPositions'];
  prop?: 'mortar' | 'cake';
  /** Starts and resets whole-show playback at the normal zoom-out cap when requested. */
  startDistance?: 'framed' | 'farthest';
  muted?: boolean;
  /** Whether the external playhead advances, independent of sound muting. */
  playing?: boolean;
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
  const clock = useRef<ReturnType<typeof visibleClock> | null>(null);
  const readiness = useRef<ReturnType<typeof viewerReadiness> | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const shots = useMemo(
    () => buildShowRendererShots(props.cues, props.launchPositions, props.showStaging === true),
    [props.cues, props.launchPositions, props.showStaging],
  );

  const currentShots = useRef(shots);
  const valid = shots.ok;
  useEffect(() => {
    currentShots.current = shots;
    if (shots.ok && viewer.current) {
      readiness.current?.reset();
      setLoading(true);
      viewer.current.setShots(shots.shots, true);
      clock.current?.wake();
    }
  }, [shots]);

  useEffect(() => {
    if (!shots.ok) latest.current.onSceneReady?.();
  }, [shots]);

  useEffect(() => {
    const sequence = currentShots.current;
    if (!container.current || !sequence.ok) return;
    setLoading(true);
    setError(null);
    let instance: Viewer;
    try {
      instance = new Viewer(container.current, {
        shots: sequence.shots,
        ui: false,
        controls: props.interactive !== false,
        clickToPause: false,
        autoplay: false,
        loop: false,
        prop: props.prop,
        startDistance: props.startDistance,
        framingDistanceScale: props.showStaging ? SHOW_FRAMING_DISTANCE_SCALE : 1,
      });
    } catch {
      setError('The firework viewer could not start. Please check WebGL support and reload.');
      latest.current.onSceneReady?.();
      setLoading(false);
      return;
    }
    viewer.current = instance;
    readiness.current = viewerReadiness(instance, () => ({
      final: latest.current.cuesFinal !== false,
      scene: () => {
        latest.current.onSceneReady?.();
        latest.current.onPrimeProgress?.(null);
      },
      ready: () => {
        setLoading(false);
        latest.current.onReady?.();
      },
    }));
    clock.current = visibleClock(
      container.current,
      () => latest.current.playing ?? latest.current.muted === false,
      () => {
        const current = latest.current;
        instance.syncTime(
          Math.max(0, current.playbackRef?.current ?? current.elapsed),
          current.muted === false && !current.scrubbing,
        );
      },
    );
    return () => {
      readiness.current?.dispose();
      readiness.current = null;
      clock.current?.dispose();
      clock.current = null;
      instance.dispose();
      viewer.current = null;
    };
  }, [valid, props.interactive, props.prop, props.startDistance, props.showStaging]);

  useEffect(() => {
    clock.current?.wake();
    readiness.current?.report();
  }, [props.elapsed, props.playing, props.muted, props.scrubbing, props.cuesFinal]);

  useEffect(() => {
    // Interactive players unlock on the first gesture; the external clock owns pause and mute.
    if (props.interactive !== false || props.muted === false) setSetting('sound', true);
  }, [props.muted, props.interactive]);

  return (
    <CanvasSurface className="absolute inset-0">
      <CanvasSurface
        ref={container}
        className="absolute inset-0 isolate overflow-hidden rounded-[inherit] bg-black"
      />
      {props.showStaging ? <ReplayViewerStats viewerRef={viewer} /> : null}
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
          {props.showStaging ? <ReplayViewerSettings /> : null}
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
          {!props.showStaging && props.allowFullscreen && props.onToggleFullscreen ? (
            <Button size="sm" variant="secondary" onClick={props.onToggleFullscreen}>
              {props.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </CanvasSurface>
  );
}
