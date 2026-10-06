/** Cancellable review preparation; neither still capture nor readiness waits for audio or display frames. */
import {
  type Viewer,
  type PosterRenderer,
  poster,
  disposePosters,
  buildPlayer,
  reviewTime,
} from '@showcrafter/renderer/view';
import { mountPosters } from './review-posters';
import { entries } from './review-catalogue';
import type { ReviewState } from './review-state';
/** Existing review thumbnail width, in CSS pixels. */
export const THUMB_WIDTH_PX = 320;
/** Existing review thumbnail height, in CSS pixels. */
export const THUMB_HEIGHT_PX = 200;
// Diagnostic readouts need ten updates per second, rather than one per GPU frame.
const READOUT_INTERVAL_MS = 100;
type StateSink<T> = (value: T | ((previous: T) => T)) => void;

/** State sinks for the owned viewer lifecycle. */
export interface ReviewSetters {
  setReady: StateSink<boolean>;
  setError: StateSink<string>;
  setPosters: StateSink<Record<string, string>>;
  setState: StateSink<ReviewState>;
  setSelected: StateSink<(typeof entries)[number]>;
}
/** Mounts transport before progressive stills, returning cancellation and teardown for both renderers. */
export function mountReviewViewer(
  setters: ReviewSetters,
  viewer: { current: Viewer | null },
  createViewer: () => Viewer,
  createPosters: () => Pick<PosterRenderer, 'capture' | 'dispose'> = () => ({
    capture: (design, time_s, options) =>
      poster(null, design, {
        ...options,
        t: time_s,
        width: THUMB_WIDTH_PX,
        height: THUMB_HEIGHT_PX,
        forceLdr: viewer.current?.options.forceLdr ?? false,
      }),
    dispose: () => {
      disposePosters().catch((cause: unknown) => {
        console.error('Poster cleanup failed', cause);
      });
    },
  }),
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
    const first = entries[0];
    if (!first) throw new Error('The review catalogue is empty.');
    rig.seek(reviewTime(first.design));
    unsubscribe = mirrorReadout(rig, setState);
    setSelected(first);
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
      gpuCandidateCount: v.gpuCandidateCount,
      hdr: v.output.hdr,
      sprayMode: v.sprayMode,
      shotCount: v.shots.length,
      timing: v.frameTimes.summary(),
      frameMs: v.frameMs,
      profile: v.profiler.result ? { ...v.profiler.result } : null,
    });
  });
}
