'use client';
import { useEffect, useRef, useState } from 'react';
import type { Design } from '@showcrafter/renderer';
import { Viewer } from '@showcrafter/renderer/view';
import { EditorPreviewTransport } from '../FireworkEditorShell';
import { createPreviewTransport, previewTransportTicks } from './preview-transport';

/** Owns one WebGL viewer and the shared editor transport, releasing resources on unmount. */
export default function PreviewSurface({
  document,
  player = true,
  loop = true,
  fullscreen,
  onFullscreenToggle,
}: {
  document: Design;
  player?: boolean;
  loop?: boolean;
  fullscreen?: boolean;
  onFullscreenToggle?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const initial = useRef(document);
  const [transport, setTransport] = useState<ReturnType<typeof createPreviewTransport> | null>(
    null,
  );
  const [failure, setFailure] = useState('');
  const [playback, setPlayback] = useState({
    elapsed: 0,
    duration: 0,
    playing: false,
    looping: loop,
  });
  useEffect(() => {
    if (!container.current) return;
    try {
      const instance = new Viewer(container.current, { design: initial.current, ui: false, loop });
      viewer.current = instance;
      const unsubscribe = instance.on((state) => {
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
        instance.dispose();
      };
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Preview unavailable.');
    }
  }, [player, loop]);
  useEffect(() => {
    viewer.current?.setDesign(document, true);
  }, [document]);
  return (
    <div className="relative h-full min-h-48 w-full">
      <div className="absolute inset-0 isolate overflow-hidden rounded-[inherit]" ref={container} />
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
    </div>
  );
}
