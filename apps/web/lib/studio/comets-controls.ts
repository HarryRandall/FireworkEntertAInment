/** Ground controls map the prototype relative interactions onto each v1 emitter. */
import type { RelativeControl } from './relative-control';
// comets height: v1 field-unit bounds/step, visual tuning around the prototype presets.
const COMETS_HEIGHT_M_MIN = 5;
const COMETS_HEIGHT_M_MAX = 140;
const COMETS_HEIGHT_M_STEP = 1;
// comets climb: v1 field-unit bounds/step, visual tuning around the prototype presets.
const COMETS_TIME_S_MIN = 0.6;
const COMETS_TIME_S_MAX = 4;
const COMETS_TIME_S_STEP = 0.05;
// comets count: v1 field-unit bounds/step, visual tuning around the prototype presets.
const COMETS_COUNT_MIN = 1;
const COMETS_COUNT_MAX = 50;
const COMETS_COUNT_STEP = 1;
// comets fan: v1 field-unit bounds/step, visual tuning around the prototype presets.
const COMETS_SPREAD_DEG_MIN = 0;
const COMETS_SPREAD_DEG_MAX = 120;
const COMETS_SPREAD_DEG_STEP = 1;
// comets star size: v1 field-unit bounds/step, visual tuning around the prototype presets.
const COMETS_SIZE_MIN = 0.3;
const COMETS_SIZE_MAX = 3;
const COMETS_SIZE_STEP = 0.05;
// comets density: v1 field-unit bounds/step, visual tuning around the prototype presets.
const COMETS_SPARKS_MIN = 0;
const COMETS_SPARKS_MAX = 200;
const COMETS_SPARKS_STEP = 1;
// comets tail length: v1 field-unit bounds/step, visual tuning around the prototype presets.
const COMETS_TAIL_LIFE_S_MIN = 0.05;
const COMETS_TAIL_LIFE_S_MAX = 3;
const COMETS_TAIL_LIFE_S_STEP = 0.05;
// comets glitter: v1 field-unit bounds/step, visual tuning around the prototype presets.
const COMETS_GLITTER_MIN = 0;
const COMETS_GLITTER_MAX = 1;
const COMETS_GLITTER_STEP = 0.05;
// comets spacing: v1 field-unit bounds/step, visual tuning around the prototype presets.
const COMETS_GAP_S_MIN = 0.05;
const COMETS_GAP_S_MAX = 3;
const COMETS_GAP_S_STEP = 0.05;
// comets spin: v1 field-unit bounds/step, visual tuning around the prototype presets.
const COMETS_SPIN_RAD_S_MIN = 0;
const COMETS_SPIN_RAD_S_MAX = 40;
const COMETS_SPIN_RAD_S_STEP = 0.1;
/** Relative comets controls, retaining authored units. */
export const COMETS_CONTROLS = [
  {
    key: 'height_m',
    label: 'Height',
    low: 'Low',
    high: 'High',
    min: COMETS_HEIGHT_M_MIN,
    max: COMETS_HEIGHT_M_MAX,
    step: COMETS_HEIGHT_M_STEP,
  },
  {
    key: 'time_s',
    label: 'Climb',
    low: 'Fast',
    high: 'Slow',
    min: COMETS_TIME_S_MIN,
    max: COMETS_TIME_S_MAX,
    step: COMETS_TIME_S_STEP,
  },
  {
    key: 'count',
    label: 'Count',
    low: 'Few',
    high: 'Many',
    min: COMETS_COUNT_MIN,
    max: COMETS_COUNT_MAX,
    step: COMETS_COUNT_STEP,
  },
  {
    key: 'spread_deg',
    label: 'Fan',
    low: 'Narrow',
    high: 'Wide',
    min: COMETS_SPREAD_DEG_MIN,
    max: COMETS_SPREAD_DEG_MAX,
    step: COMETS_SPREAD_DEG_STEP,
  },
  {
    key: 'size',
    label: 'Star size',
    low: 'Fine',
    high: 'Bold',
    min: COMETS_SIZE_MIN,
    max: COMETS_SIZE_MAX,
    step: COMETS_SIZE_STEP,
  },
  {
    key: 'sparks',
    label: 'Density',
    low: 'Thin',
    high: 'Thick',
    min: COMETS_SPARKS_MIN,
    max: COMETS_SPARKS_MAX,
    step: COMETS_SPARKS_STEP,
  },
  {
    key: 'tail_life_s',
    label: 'Tail length',
    low: 'Short',
    high: 'Long',
    min: COMETS_TAIL_LIFE_S_MIN,
    max: COMETS_TAIL_LIFE_S_MAX,
    step: COMETS_TAIL_LIFE_S_STEP,
  },
  {
    key: 'glitter',
    label: 'Glitter',
    low: 'None',
    high: 'Lots',
    min: COMETS_GLITTER_MIN,
    max: COMETS_GLITTER_MAX,
    step: COMETS_GLITTER_STEP,
  },
  {
    key: 'gap_s',
    label: 'Spacing',
    low: 'Close',
    high: 'Apart',
    min: COMETS_GAP_S_MIN,
    max: COMETS_GAP_S_MAX,
    step: COMETS_GAP_S_STEP,
  },
  {
    key: 'spin_rad_s',
    label: 'Spin',
    low: 'Gentle',
    high: 'Fast',
    min: COMETS_SPIN_RAD_S_MIN,
    max: COMETS_SPIN_RAD_S_MAX,
    step: COMETS_SPIN_RAD_S_STEP,
  },
] as const satisfies readonly RelativeControl[];
