/** Deterministic thumbnail moments retain the prototype's developed trails. */
import { resolveDesign, type Design } from '../schema/index';

// Prototype visual tuning, in seconds and fractions of effect life.
const CLIMB_FRACTION = 0.8;
const SEQUENCE_OFFSET_S = 1;
const MINE_TIME_S = 0.9;
const FOUNTAIN_TIME_S = 2.2;
const WHEEL_TIME_S = 2.5;
const SPINNER_TIME_S = 2;
const MAX_BURST_AGE_S = 1.2;
const BURST_LIFE_FRACTION = 0.42;

/** Returns design-relative seconds for the prototype's best moment, after stored adjustments.
 * Does not mutate the validated design; delayed breaks retain their own clock origin. */
export function developedTime(input: Design): number {
  const design = resolveDesign(input);
  switch (design.kind) {
    case 'comet':
    case 'candle':
      return (
        design.ground.comets.time_s * CLIMB_FRACTION +
        (design.ground.comets.pattern === 'sequence' ? SEQUENCE_OFFSET_S : 0)
      );
    case 'mine':
      return MINE_TIME_S;
    case 'fountain':
      return FOUNTAIN_TIME_S;
    case 'tourbillon':
      return design.ground.tourbillon.time_s * CLIMB_FRACTION;
    case 'wheel':
      return WHEEL_TIME_S;
    case 'spinner':
      return SPINNER_TIME_S;
    case 'shell':
    case 'rocket': {
      const burst = design.breaks[0];
      const layer = burst?.layers[0];
      return (
        design.launch.time_s +
        (burst?.at_s ?? 0) +
        (layer?.delay_s ?? 0) +
        Math.min(MAX_BURST_AGE_S, (layer?.life_s ?? 0) * BURST_LIFE_FRACTION)
      );
    }
  }
}
