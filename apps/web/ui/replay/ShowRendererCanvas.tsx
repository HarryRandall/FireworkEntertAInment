'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Viewer, setSetting } from '@showcrafter/renderer/view';
import { buildShowRendererShots } from '@/lib/shows/renderer-shots';
import type { FireworkReplayCanvas as LegacyCanvas } from './FireworkReplayCanvas';
import { Button } from '@/ui/patterns/Button';

type Props = ComponentProps<typeof LegacyCanvas> & {
  prop?: 'mortar' | 'cake';
  legacyEditor?: boolean;
};
const LegacyEditorCanvas = dynamic(
  () => import('./FireworkReplayCanvas').then((module) => module.FireworkReplayCanvas),
  { ssr: false },
);

/** Stateless show playback driven by the parent's soundtrack clock, including exact scrubs. */
export function FireworkReplayCanvas(props: Props) {
  return props.legacyEditor ? <LegacyEditorCanvas {...props} /> : <ShowCanvas {...props} />;
}

function ShowCanvas(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
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
    let instance: Viewer;
    try {
      instance = new Viewer(container.current, {
        shots: shots.shots,
        controls: props.interactive !== false,
        clickToPause: false,
        autoplay: false,
        loop: false,
        prop: props.prop,
      });
    } catch {
      setError('The firework viewer could not start. Please check WebGL support and reload.');
      latest.current.onSceneReady?.();
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
        className="absolute inset-0 overflow-hidden rounded-[inherit] bg-black"
      />
      {!shots.ok || error ? (
        <div
          role="alert"
          className="bg-background text-status-danger absolute inset-0 flex items-center justify-center p-4"
        >
          {shots.ok ? error : shots.error}
        </div>
      ) : null}
      {props.interactive !== false && props.showCameraControls !== false ? (
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
