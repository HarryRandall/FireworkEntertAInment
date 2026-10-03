/** Ghost transition timing belongs to the colour envelope consumed by the renderer. */
import type { RelativeControl } from './relative-control';
const CHANGE_MIN = 0.1; // Normalised life, editor.html colour-change lower bound.
const CHANGE_MAX = 0.9; // Normalised life, editor.html colour-change upper bound.
const CHANGE_STEP = 0.01; // Normalised life, prototype fine-control resolution.
/** Relative timing for the colour transition around which a ghost goes dark. */
export const GHOST_CHANGE_CONTROL: RelativeControl = {
  key: 'at',
  label: 'Ghost colour change',
  low: 'Early',
  high: 'Late',
  min: CHANGE_MIN,
  max: CHANGE_MAX,
  step: CHANGE_STEP,
};
