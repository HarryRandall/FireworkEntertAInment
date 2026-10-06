'use client';
import { useEffect, useRef, useState } from 'react';
import type { Design } from '@showcrafter/renderer';
import { Viewer } from '@showcrafter/renderer/view';

/** Owns one WebGL viewer and its built-in player, releasing resources on unmount. */
export default function PreviewSurface({
  document,
  player = true,
  loop = false,
}: {
  document: Design;
  player?: boolean;
  loop?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const initial = useRef(document);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    if (!container.current) return;
    try {
      const instance = new Viewer(container.current, { design: initial.current, ui: player, loop });
      viewer.current = instance;
      if (loop) instance.play();
      return () => {
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
    <div className="relative h-full min-h-48 w-full" ref={container}>
      {failure && (
        <p role="alert" className="bg-card text-status-danger p-3 text-sm">
          {failure}
        </p>
      )}
    </div>
  );
}
