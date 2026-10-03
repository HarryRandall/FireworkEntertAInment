/** Ground controls map the prototype relative interactions onto each v1 emitter. */
import type { RelativeControl } from './relative-control';
// spinner duration: v1 field-unit bounds/step, visual tuning around the prototype presets.
const SPINNER_DURATION_S_MIN = 1;
const SPINNER_DURATION_S_MAX = 20;
const SPINNER_DURATION_S_STEP = 0.1;
// spinner count: v1 field-unit bounds/step, visual tuning around the prototype presets.
const SPINNER_COUNT_MIN = 1;
const SPINNER_COUNT_MAX = 30;
const SPINNER_COUNT_STEP = 1;
// spinner spin: v1 field-unit bounds/step, visual tuning around the prototype presets.
const SPINNER_SPIN_RAD_S_MIN = 0;
const SPINNER_SPIN_RAD_S_MAX = 40;
const SPINNER_SPIN_RAD_S_STEP = 0.1;
// spinner wander: v1 field-unit bounds/step, visual tuning around the prototype presets.
const SPINNER_WANDER_M_MIN = 0;
const SPINNER_WANDER_M_MAX = 10;
const SPINNER_WANDER_M_STEP = 0.1;
// spinner density: v1 field-unit bounds/step, visual tuning around the prototype presets.
const SPINNER_SPARKS_MIN = 0;
const SPINNER_SPARKS_MAX = 200;
const SPINNER_SPARKS_STEP = 1;
/** Relative spinner controls, retaining authored units. */
export const SPINNER_CONTROLS = [
  {
    key: 'duration_s',
    label: 'Duration',
    low: 'Short',
    high: 'Long',
    min: SPINNER_DURATION_S_MIN,
    max: SPINNER_DURATION_S_MAX,
    step: SPINNER_DURATION_S_STEP,
  },
  {
    key: 'count',
    label: 'Count',
    low: 'Few',
    high: 'Many',
    min: SPINNER_COUNT_MIN,
    max: SPINNER_COUNT_MAX,
    step: SPINNER_COUNT_STEP,
  },
  {
    key: 'spin_rad_s',
    label: 'Spin',
    low: 'Gentle',
    high: 'Fast',
    min: SPINNER_SPIN_RAD_S_MIN,
    max: SPINNER_SPIN_RAD_S_MAX,
    step: SPINNER_SPIN_RAD_S_STEP,
  },
  {
    key: 'wander_m',
    label: 'Wander',
    low: 'Still',
    high: 'Wide',
    min: SPINNER_WANDER_M_MIN,
    max: SPINNER_WANDER_M_MAX,
    step: SPINNER_WANDER_M_STEP,
  },
  {
    key: 'sparks',
    label: 'Density',
    low: 'Thin',
    high: 'Thick',
    min: SPINNER_SPARKS_MIN,
    max: SPINNER_SPARKS_MAX,
    step: SPINNER_SPARKS_STEP,
  },
] as const satisfies readonly RelativeControl[];
