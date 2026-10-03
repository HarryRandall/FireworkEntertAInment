/** Cancellable review preparation; neither still capture nor readiness waits for audio or display frames. */
import type { RefObject, Dispatch, SetStateAction } from 'react';
import { type Viewer, PosterRenderer, buildPlayer, reviewTime } from '@showcrafter/fireworks/view';
import { mountPosters } from './review-posters';
import { entries } from './review-catalogue';
import type { ReviewState } from './review-state';
/** Existing review thumbnail width, in CSS pixels. */
export const THUMB_WIDTH_PX = 320;
/** Existing review thumbnail height, in CSS pixels. */
export const THUMB_HEIGHT_PX = 200;
// React diagnostic readouts need ten updates per second, rather than one per GPU frame.
const READOUT_INTERVAL_MS = 100;
/** React state sinks for the owned viewer lifecycle. */
export interface ReviewSetters {
  setReady: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setPosters: Dispatch<SetStateAction<Record<string, string>>>;
  setState: Dispatch<SetStateAction<ReviewState>>;
  setSelected: Dispatch<SetStateAction<(typeof entries)[number]>>;
}
/** Mounts transport before progressive stills, returning cancellation and teardown for both renderers. */
export function mountReviewViewer(
  setters: ReviewSetters,
  viewer: RefObject<Viewer | null>,
  createViewer: () => Viewer,
  createPosters: () => Pick<PosterRenderer, 'capture' | 'dispose'> = () =>
    new PosterRenderer(THUMB_WIDTH_PX, THUMB_HEIGHT_PX, viewer.current?.options.forceLdr),
) {
  const { setReady, setError, setPosters, setState, setSelected } = setters;
  let rig: Viewer | null = null;
  let unsubscribe = () => {};
  let removePlayer = () => {};
  let removePosters = () => {};
  setReady(false);
  setError('');
  setPosters({});
  try {
    rig = createViewer();
    viewer.current = rig;
    rig.seek(reviewTime(entries[0].design));
    unsubscribe = mirrorReadout(rig, setState);
    setSelected(entries[0]);
    removePlayer = buildPlayer(rig);
    setReady(true);
    removePosters = mountPosters(
      setPosters,
      setError,
      createPosters,
      () => rig?.liveDrawPending ?? false,
    );
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : 'The WebGL preview could not start.');
    unsubscribe();
    removePlayer();
    rig?.dispose();
    viewer.current = null;
  }
  return () => {
    removePosters();
    unsubscribe();
    removePlayer();
    rig?.dispose();
    viewer.current = null;
  };
}

function mirrorReadout(rig: Viewer, setState: ReviewSetters['setState']): () => void {
  let lastReadout = 0;
  let wasPlaying = false;
  return rig.on((v) => {
    const now = performance.now();
    if (v.playing && wasPlaying && now - lastReadout < READOUT_INTERVAL_MS) return;
    lastReadout = now;
    wasPlaying = v.playing;
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
      profile: v.profiler.result ? { ...v.profiler.result } : null,
    });
  });
}
