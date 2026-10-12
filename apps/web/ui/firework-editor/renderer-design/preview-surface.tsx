'use client';

import { playbackReadoutGate } from '@/ui/renderer/playback-readout';
import { CanvasSurface } from '@/ui/renderer/CanvasSurface';
import { useEffect, useRef, useState } from 'react';
import type { Design } from '@showcrafter/renderer';
import { Viewer, prefersLowPower } from '@showcrafter/renderer/view';
import { EditorPreviewTransport } from '../FireworkEditorShell';
import { createPreviewTransport, previewTransportTicks } from './preview-transport';
import type { ReferenceClip } from '@/lib/renderer-editor/reference';
import { ReferenceVideo } from './reference-video';

/** Owns one WebGL viewer and the shared editor transport, releasing resources on unmount. */
export default function PreviewSurface({
  document,
  player = true,
  loop = true,
  fullscreen,
  onFullscreenToggle,
  reference = null,
  lowPower = false,
}: {
  document: Design;
  reference?: ReferenceClip | null;
  player?: boolean;
  loop?: boolean;
  fullscreen?: boolean;
  onFullscreenToggle?: () => void;
  /** Fewer pixels, no smoke and a 30 fps cap; 'auto' applies it on phones and weak devices. */
  lowPower?: boolean | 'auto';
}) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const initial = useRef(document);
  const [transport, setTransport] = useState<ReturnType<typeof createPreviewTransport> | null>(
    null,
  );
  const [failure, setFailure] = useState('');
  const [liveViewer, setLiveViewer] = useState<Viewer | null>(null);
  const [playback, setPlayback] = useState({
    elapsed: 0,
    duration: 0,
    playing: false,
    looping: loop,
  });
  useEffect(() => {
    if (!container.current) return;
    try {
      const instance = new Viewer(container.current, {
        design: initial.current,
        ui: false,
        loop,
        lowPower: lowPower === 'auto' ? prefersLowPower() : lowPower,
      });
      viewer.current = instance;
      setLiveViewer(instance);
      const readout = playbackReadoutGate();
      const unsubscribe = instance.on((state) => {
        if (!readout({ time: state.t, duration: state.duration, playing: state.playing })) return;
        setPlayback({
          elapsed: state.t,
          duration: state.duration,
          playing: state.playing,
          looping: state.options.loop === true,
        });
      });
      if (!player && loop) instance.play();
      setTransport(createPreviewTransport(instance));
      return () => {
        unsubscribe();
        viewer.current = null;
        setLiveViewer(null);
        instance.dispose();
      };
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Preview unavailable.');
    }
  }, [player, loop, lowPower]);
  useEffect(() => {
    const instance = viewer.current;
    if (instance && instance.shots[0]?.design !== document) instance.setDesign(document, true);
  }, [document]);
  return (
    <CanvasSurface className="h-full min-h-48 w-full">
      <div className={reference ? 'absolute inset-0 grid grid-cols-2 gap-px' : 'absolute inset-0'}>
        <CanvasSurface className="relative h-full min-h-0" ref={container} />
        {reference && <ReferenceVideo clip={reference} viewer={liveViewer} />}
      </div>
      {player && transport && !failure && (
        <div className="absolute inset-x-0 bottom-5 z-30">
          <EditorPreviewTransport
            elapsed={playback.elapsed}
            duration={playback.duration}
            ticks={previewTransportTicks(document)}
            isPlaying={playback.playing}
            isLooping={playback.looping}
            fullscreen={fullscreen}
            onFullscreenToggle={onFullscreenToggle}
            {...transport}
            onLoopToggle={() => {
              transport.onLoopToggle();
              setPlayback((state) => ({
                ...state,
                looping: viewer.current?.options.loop === true,
              }));
            }}
          />
        </div>
      )}
      {failure && (
        <p role="alert" className="bg-card text-status-danger p-3 text-sm">
          {failure}
        </p>
      )}
    </CanvasSurface>
  );
}
