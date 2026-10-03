/** Shared-context viewer lifecycle and cancellable thumbnail generation. */
'use client';
import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Viewer, reviewTime } from '@showcrafter/fireworks/view';
import { entries } from './review-catalogue';
import type { ReviewState } from './review-state';
/** Review thumbnail width, CSS pixels, matching the existing developer viewport. */
export const THUMB_WIDTH_PX = 320;
/** Review thumbnail height, CSS pixels, matching the existing developer viewport. */
export const THUMB_HEIGHT_PX = 200;
interface ReviewSetters {
  setReady: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setPosters: Dispatch<SetStateAction<Record<string, string>>>;
  setState: Dispatch<SetStateAction<ReviewState>>;
  setSelected: Dispatch<SetStateAction<(typeof entries)[number]>>;
}
/** Owns a single viewer, cleaning it up on a retry or unmount and mirroring its readout. */
export function useReviewViewer(
  host: RefObject<HTMLDivElement | null>,
  generation: number,
  setSelected: ReviewSetters['setSelected'],
) {
  const viewer = useRef<Viewer | null>(null);
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<ReviewState>({
    t: 0,
    duration: 0,
    playing: false,
    count: 0,
    hdr: false,
    sprayMode: 'gpu',
    shotCount: 1,
    timing: { medianMs: 0, p95Ms: 0, samples: 0, window: 0 },
    frameMs: 0,
  });
  useEffect(() => {
    const element = host.current;
    if (element === null) return;
    return mountReviewViewer(
      element,
      { setPosters, setError, setReady, setState, setSelected },
      viewer,
    );
  }, [host, generation, setSelected]);
  return { viewer, posters, error, ready, state };
}
function mountReviewViewer(
  element: HTMLDivElement,
  setters: ReviewSetters,
  viewer: RefObject<Viewer | null>,
) {
  const { setReady, setError, setPosters, setState, setSelected } = setters;
  let cancelled = false;
  let rig: Viewer | null = null;
  let unsubscribe = () => {};
  setReady(false);
  setError('');
  setPosters({});
  async function initialise() {
    try {
      rig = new Viewer(element, {
        design: entries[0].design,
        autoplay: false,
        forceLdr: new URLSearchParams(location.search).has('ldr'),
      });
      viewer.current = rig;
      // Reuse the live context while generating stills. No card owns a renderer.
      const images = await preparePosters(rig, () => cancelled);
      if (cancelled) return;
      setPosters(images);
      setReady(true);
      rig.setDesign(entries[0].design);
      rig.seek(reviewTime(entries[0].design));
      unsubscribe = rig.on((v) => {
        setState({
          t: v.t,
          duration: v.duration,
          playing: v.playing,
          count: v.count,
          hdr: v.output.hdr,
          sprayMode: v.sprayMode,
          shotCount: v.shots.length,
          timing: v.frameTimes.summary(),
          frameMs: v.frameMs,
        });
      });
      setSelected(entries[0]);
    } catch (cause) {
      if (!cancelled)
        setError(cause instanceof Error ? cause.message : 'The WebGL preview could not start.');
      rig?.dispose();
      viewer.current = null;
    }
  }
  initialise().catch((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : 'The WebGL preview could not start.');
  });
  return () => {
    cancelled = true;
    unsubscribe();
    rig?.dispose();
    viewer.current = null;
  };
}

async function preparePosters(
  rig: Viewer,
  cancelled: () => boolean,
): Promise<Record<string, string>> {
  const images: Record<string, string> = {};
  for (const entry of entries) {
    if (cancelled()) return images;
    rig.setDesign(entry.design);
    rig.seek(reviewTime(entry.design));
    images[entry.key] = rig.capture(THUMB_WIDTH_PX, THUMB_HEIGHT_PX);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        resolve();
      }),
    );
  }
  return images;
}
