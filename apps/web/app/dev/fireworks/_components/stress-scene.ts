/** The prototype's forty-shot finale, retaining timing, placement, tilt and seed sequences. */
import { effectTemplates } from '@showcrafter/fireworks';
import type { Shot } from '@showcrafter/fireworks/view';

// Prototype finale recipe: shot counts, seconds between launches, degrees of tilt and metre spacing.
const SHOT_COUNT = 40;
const REGULAR_SHOTS = 30;
const REGULAR_GAP_S = 0.35;
const FINALE_START_S = 10.5;
const FINALE_GAP_S = 0.08;
const TILT_COLUMNS = 5;
const TILT_CENTRE = 2;
const TILT_STEP_DEG = 10;
const X_COLUMNS = 7;
const X_CENTRE = 3;
const X_SPACING_M = 14;
const Z_ROWS = 3;
const Z_SPACING_M = 10;
const FIRST_SEED = 3;
const SEED_STEP = 7;
const PRESETS = [
  'peony',
  'chrysanthemum',
  'willow',
  'neutron',
  'crossette',
  'palm',
  'brocade',
  'strobe',
  'crackle',
  'ghost',
];
/** Builds independent stored designs for the prototype finale, in seconds and world metres. */
export function stressShots(): Shot[] {
  return Array.from({ length: SHOT_COUNT }, (_, index) => {
    const key = PRESETS[index % PRESETS.length];
    const template = effectTemplates.find((entry) => entry.key === key);
    if (!template || !template.design.launch) throw new Error(`Missing stress shell: ${key}`);
    const design = structuredClone(template.design);
    design.launch.tilt_deg = ((index % TILT_COLUMNS) - TILT_CENTRE) * TILT_STEP_DEG;
    return {
      design,
      t0:
        index < REGULAR_SHOTS
          ? index * REGULAR_GAP_S
          : FINALE_START_S + (index - REGULAR_SHOTS) * FINALE_GAP_S,
      position: [
        ((index % X_COLUMNS) - X_CENTRE) * X_SPACING_M,
        ((index % Z_ROWS) - 1) * Z_SPACING_M,
      ],
      seed: FIRST_SEED + index * SEED_STEP,
    };
  });
}
