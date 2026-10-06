/** Browser motion policy applies to every surface that owns a Viewer. */
import { developedTime } from '../poster/moment';
import type { Shot } from './types';
import type { Viewer } from './viewer';

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Returns sequence seconds at the first developed firing; empty sequences use zero.
 * Does not mutate shots; designs must be validated before sampling. */
export function representativeTime(shots: readonly Shot[]): number {
  const first = shots.at(0);
  return first ? (first.t0 ?? 0) + developedTime(first.design) : 0;
}

/** Applies initial autoplay policy and pauses at a still when reduction is enabled.
 * Explicit play remains available; removing reduction never resumes without user input.
 * Returns cleanup for the browser preference subscription. */
export function observeMotionPreference(viewer: Viewer): () => void {
  const media = window.matchMedia(MOTION_QUERY);
  const still = () => {
    viewer.pause();
    viewer.seek(representativeTime(viewer.shots));
  };
  viewer.t = Math.max(
    0,
    Math.min(
      viewer.duration,
      viewer.options.startAt ?? (media.matches ? representativeTime(viewer.shots) : 0),
    ),
  );
  viewer.playing = viewer.options.autoplay !== false && !media.matches;
  const changed = () => {
    if (media.matches) still();
  };
  media.addEventListener('change', changed);
  return () => {
    media.removeEventListener('change', changed);
  };
}
