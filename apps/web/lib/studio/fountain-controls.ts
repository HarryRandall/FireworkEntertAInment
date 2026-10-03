/** Ground controls map the prototype relative interactions onto each v1 emitter. */
import type { RelativeControl } from './relative-control';
// fountain height: v1 field-unit bounds/step, visual tuning around the prototype presets.
const FOUNTAIN_SPEED_M_S_MIN = 2;
const FOUNTAIN_SPEED_M_S_MAX = 50;
const FOUNTAIN_SPEED_M_S_STEP = 0.1;
// fountain duration: v1 field-unit bounds/step, visual tuning around the prototype presets.
const FOUNTAIN_DURATION_S_MIN = 1;
const FOUNTAIN_DURATION_S_MAX = 20;
const FOUNTAIN_DURATION_S_STEP = 0.1;
// fountain density: v1 field-unit bounds/step, visual tuning around the prototype presets.
const FOUNTAIN_RATE_PER_S_MIN = 0;
const FOUNTAIN_RATE_PER_S_MAX = 4000;
const FOUNTAIN_RATE_PER_S_STEP = 10;
// fountain spray: v1 field-unit bounds/step, visual tuning around the prototype presets.
const FOUNTAIN_CONE_MIN = 0;
const FOUNTAIN_CONE_MAX = 1;
const FOUNTAIN_CONE_STEP = 0.01;
// fountain burn: v1 field-unit bounds/step, visual tuning around the prototype presets.
const FOUNTAIN_LIFE_S_MIN = 0.1;
const FOUNTAIN_LIFE_S_MAX = 3;
const FOUNTAIN_LIFE_S_STEP = 0.05;
// fountain fall: v1 field-unit bounds/step, visual tuning around the prototype presets.
const FOUNTAIN_GRAVITY_M_S2_MIN = 0;
const FOUNTAIN_GRAVITY_M_S2_MAX = 20;
const FOUNTAIN_GRAVITY_M_S2_STEP = 0.1;
// fountain air drag: v1 field-unit bounds/step, visual tuning around the prototype presets.
const FOUNTAIN_DRAG_PER_S_MIN = 0.01;
const FOUNTAIN_DRAG_PER_S_MAX = 4;
const FOUNTAIN_DRAG_PER_S_STEP = 0.01;
// fountain spark size: v1 field-unit bounds/step, visual tuning around the prototype presets.
const FOUNTAIN_SIZE_MIN = 0.3;
const FOUNTAIN_SIZE_MAX = 3;
const FOUNTAIN_SIZE_STEP = 0.05;
// fountain glitter: v1 field-unit bounds/step, visual tuning around the prototype presets.
const FOUNTAIN_GLITTER_MIN = 0;
const FOUNTAIN_GLITTER_MAX = 1;
const FOUNTAIN_GLITTER_STEP = 0.05;
/** Relative fountain controls, retaining authored units. */
export const FOUNTAIN_CONTROLS = [
  {
    key: 'speed_m_s',
    label: 'Height',
    low: 'Low',
    high: 'High',
    min: FOUNTAIN_SPEED_M_S_MIN,
    max: FOUNTAIN_SPEED_M_S_MAX,
    step: FOUNTAIN_SPEED_M_S_STEP,
  },
  {
    key: 'duration_s',
    label: 'Duration',
    low: 'Short',
    high: 'Long',
    min: FOUNTAIN_DURATION_S_MIN,
    max: FOUNTAIN_DURATION_S_MAX,
    step: FOUNTAIN_DURATION_S_STEP,
  },
  {
    key: 'rate_per_s',
    label: 'Density',
    low: 'Thin',
    high: 'Thick',
    min: FOUNTAIN_RATE_PER_S_MIN,
    max: FOUNTAIN_RATE_PER_S_MAX,
    step: FOUNTAIN_RATE_PER_S_STEP,
  },
  {
    key: 'cone',
    label: 'Spray',
    low: 'Narrow',
    high: 'Wide',
    min: FOUNTAIN_CONE_MIN,
    max: FOUNTAIN_CONE_MAX,
    step: FOUNTAIN_CONE_STEP,
  },
  {
    key: 'life_s',
    label: 'Burn',
    low: 'Short',
    high: 'Long',
    min: FOUNTAIN_LIFE_S_MIN,
    max: FOUNTAIN_LIFE_S_MAX,
    step: FOUNTAIN_LIFE_S_STEP,
  },
  {
    key: 'gravity_m_s2',
    label: 'Fall',
    low: 'Floaty',
    high: 'Heavy',
    min: FOUNTAIN_GRAVITY_M_S2_MIN,
    max: FOUNTAIN_GRAVITY_M_S2_MAX,
    step: FOUNTAIN_GRAVITY_M_S2_STEP,
  },
  {
    key: 'drag_per_s',
    label: 'Air drag',
    low: 'Floaty',
    high: 'Heavy',
    min: FOUNTAIN_DRAG_PER_S_MIN,
    max: FOUNTAIN_DRAG_PER_S_MAX,
    step: FOUNTAIN_DRAG_PER_S_STEP,
  },
  {
    key: 'size',
    label: 'Spark size',
    low: 'Fine',
    high: 'Bold',
    min: FOUNTAIN_SIZE_MIN,
    max: FOUNTAIN_SIZE_MAX,
    step: FOUNTAIN_SIZE_STEP,
  },
  {
    key: 'glitter',
    label: 'Glitter',
    low: 'None',
    high: 'Lots',
    min: FOUNTAIN_GLITTER_MIN,
    max: FOUNTAIN_GLITTER_MAX,
    step: FOUNTAIN_GLITTER_STEP,
  },
] as const satisfies readonly RelativeControl[];
