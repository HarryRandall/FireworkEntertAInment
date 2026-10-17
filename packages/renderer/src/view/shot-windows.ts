/** Sequence-local visibility windows, resolved once rather than cloning every past design per frame. */
import { shotDuration } from '../sim/index';
import type { Shot } from './types';

type ShotWindow = { shot: Shot; index: number; start: number; end: number };
type Sequence = { shots: readonly Shot[]; windows: ShotWindow[] };
const sequences = new WeakMap<object, Sequence>();

/** Rebuilds windows on setShots, including when an editor reuses its array after changing a design. */
export function prepareShotSequence(owner: object, shots: readonly Shot[]): number {
  let duration = 0;
  const windows = shots.map((shot, index) => {
    const start = shot.t0 ?? 0;
    const end = start + shotDuration(shot.design);
    duration = Math.max(duration, end);
    return { shot, index, start, end };
  });
  sequences.set(owner, { shots, windows });
  return duration;
}

/** Retains source order and original indices for cake placement, including backwards seeks. */
export function forEachActiveShot(
  owner: object,
  shots: readonly Shot[],
  time: number,
  visit: (shot: Shot, index: number, age: number) => void,
): void {
  if (sequences.get(owner)?.shots !== shots) prepareShotSequence(owner, shots);
  const sequence = sequences.get(owner);
  if (!sequence) return;
  for (const window of sequence.windows) {
    if (time < window.start || time > window.end) continue;
    visit(window.shot, window.index, time - window.start);
  }
}
