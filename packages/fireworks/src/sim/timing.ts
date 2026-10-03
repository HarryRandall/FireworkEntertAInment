/** Conservative visible-duration calculation for every stored firework kind. */
import { resolveDesign, type Design } from '../schema/index';

// Prototype visual tail allowances, in seconds.
const COMET_AFTERGLOW_S = 1.8;
const SPLIT_DEFAULT_LIFE_S = 0.7;
const SEQUENCE_DEFAULT_GAP_S = 0.5;
const WHEEL_TAIL_S = 1.4;
const SPINNER_STAGGER_S = 0.4;
const SPINNER_TAIL_S = 0.8;
const FOUNTAIN_TAIL_S = 0.4;
const CRACKLE_TAIL_S = 0.5;
const CROSSETTE_TAIL_S = 0.8;
const POP_TAIL_S = 0.7;
const TRAIL_DURATION_SCALE = 1.3;

/** Computes the last possible visible particle time in seconds from firing. */
export function shotDuration(design: Design): number {
  design = resolveDesign(design);
  if (design.kind === 'comet' || design.kind === 'candle') {
    const c = design.ground.comets;
    return (
      c.time_s +
      COMET_AFTERGLOW_S +
      (c.split ? c.split.life_s || SPLIT_DEFAULT_LIFE_S : 0) +
      (c.pattern === 'sequence' ? (c.count - 1) * (c.gap_s || SEQUENCE_DEFAULT_GAP_S) : 0)
    );
  }
  if (design.kind === 'wheel') return design.ground.wheel.duration_s + WHEEL_TAIL_S;
  if (design.kind === 'spinner')
    return (
      design.ground.spinner.duration_s +
      design.ground.spinner.count * SPINNER_STAGGER_S +
      SPINNER_TAIL_S
    );
  if (design.kind === 'fountain')
    return design.ground.fountain.duration_s + design.ground.fountain.life_s + FOUNTAIN_TAIL_S;
  if (design.kind === 'tourbillon') return design.ground.tourbillon.time_s + WHEEL_TAIL_S;
  let life = 0;
  for (const b of design.breaks)
    for (const l of b.layers) {
      // Several modifiers are stored in v1. Their longest tail determines the duration.
      const extra = Math.max(
        0,
        ...l.modifiers.map((m) =>
          m.kind === 'crackle'
            ? CRACKLE_TAIL_S
            : m.kind === 'crossette' || m.kind === 'split'
              ? CROSSETTE_TAIL_S
              : m.kind === 'pop'
                ? POP_TAIL_S
                : 0,
        ),
      );
      life = Math.max(
        life,
        b.at_s +
          l.delay_s +
          l.life_s * (1 + l.life_var) +
          l.trail.length_s * TRAIL_DURATION_SCALE +
          extra,
      );
    }
  return (design.kind === 'mine' ? 0 : design.launch.time_s) + Math.max(life, 1) + 0.4;
}
