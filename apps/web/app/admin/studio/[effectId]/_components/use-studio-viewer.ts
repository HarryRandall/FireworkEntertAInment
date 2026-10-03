/** Browser lifecycles for Studio's single Viewer and preview-only listening position. */
'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { framingFor, EYE_HEIGHT_M, type Design } from '@showcrafter/fireworks';
import { Viewer } from '@showcrafter/fireworks/view';

/** Owns one Viewer and its teardown; listener distance is world metres, or null to retain automatic framing. */
export function useStudioViewer(
  document: Design,
  hidden: boolean,
  listenerDistanceM: number | null,
) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const initial = useRef(document);
  const [failure, setFailure] = useState('');
  const [clock, setClock] = useState({ time: 0, duration: 0, playing: false });
  useEffect(() => {
    if (!container.current) return;
    let active: Viewer;
    try {
      active = new Viewer(container.current, {
        design: initial.current,
        ui: false,
        clickToPause: false,
      });
    } catch {
      setFailure('The live preview could not start. Check WebGL support and reload.');
      return;
    }
    viewer.current = active;
    const unsubscribe = active.on((value) => {
      setClock({ time: value.t, duration: value.duration, playing: value.playing });
    });
    return () => {
      unsubscribe();
      active.dispose();
      viewer.current = null;
    };
  }, []);
  useEffect(() => {
    if (hidden) viewer.current?.setShots([], true);
    else viewer.current?.setDesign(document, true);
  }, [document, hidden]);
  useListenerDistance(viewer, document, listenerDistanceM);
  return { container, viewer, failure, clock };
}

function useListenerDistance(
  viewer: RefObject<Viewer | null>,
  document: Design,
  listenerDistanceM: number | null,
) {
  useEffect(() => {
    const active = viewer.current;
    if (!active || listenerDistanceM === null) return;
    const framing = framingFor(
      [{ design: document }],
      false,
      active.camera.aspect,
      active.camera.fov,
    );
    active.controls.frame(
      {
        target: framing.target,
        position: [framing.target[0], EYE_HEIGHT_M, framing.target[2] + listenerDistanceM],
      },
      true,
    );
    active.controls.touched = true;
  }, [document, listenerDistanceM, viewer]);
}
