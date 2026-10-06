/** Ground controls map the reference editor relative interactions onto each v1 emitter. */
import type { RelativeControl } from './relative-control';
// tourbillon height: v1 field-unit bounds/step, visual tuning around the reference editor presets.
const TOURBILLON_HEIGHT_M_MIN = 5;
const TOURBILLON_HEIGHT_M_MAX = 140;
const TOURBILLON_HEIGHT_M_STEP = 1;
// tourbillon climb: v1 field-unit bounds/step, visual tuning around the reference editor presets.
const TOURBILLON_TIME_S_MIN = 0.6;
const TOURBILLON_TIME_S_MAX = 4;
const TOURBILLON_TIME_S_STEP = 0.05;
// tourbillon count: v1 field-unit bounds/step, visual tuning around the reference editor presets.
const TOURBILLON_COUNT_MIN = 1;
const TOURBILLON_COUNT_MAX = 30;
const TOURBILLON_COUNT_STEP = 1;
// tourbillon spin: v1 field-unit bounds/step, visual tuning around the reference editor presets.
const TOURBILLON_SPIN_RAD_S_MIN = 0;
const TOURBILLON_SPIN_RAD_S_MAX = 40;
const TOURBILLON_SPIN_RAD_S_STEP = 0.1;
// tourbillon spiral size: v1 field-unit bounds/step, visual tuning around the reference editor presets.
const TOURBILLON_RADIUS_M_MIN = 0;
const TOURBILLON_RADIUS_M_MAX = 10;
const TOURBILLON_RADIUS_M_STEP = 0.1;
// tourbillon density: v1 field-unit bounds/step, visual tuning around the reference editor presets.
const TOURBILLON_SPARKS_MIN = 0;
const TOURBILLON_SPARKS_MAX = 200;
const TOURBILLON_SPARKS_STEP = 1;
/** Relative tourbillon controls, retaining authored units. */
export const TOURBILLON_CONTROLS = [
  {
    key: 'height_m',
    label: 'Height',
    low: 'Low',
    high: 'High',
    min: TOURBILLON_HEIGHT_M_MIN,
    max: TOURBILLON_HEIGHT_M_MAX,
    step: TOURBILLON_HEIGHT_M_STEP,
  },
  {
    key: 'time_s',
    label: 'Climb',
    low: 'Fast',
    high: 'Slow',
    min: TOURBILLON_TIME_S_MIN,
    max: TOURBILLON_TIME_S_MAX,
    step: TOURBILLON_TIME_S_STEP,
  },
  {
    key: 'count',
    label: 'Count',
    low: 'Few',
    high: 'Many',
    min: TOURBILLON_COUNT_MIN,
    max: TOURBILLON_COUNT_MAX,
    step: TOURBILLON_COUNT_STEP,
  },
  {
    key: 'spin_rad_s',
    label: 'Spin',
    low: 'Gentle',
    high: 'Fast',
    min: TOURBILLON_SPIN_RAD_S_MIN,
    max: TOURBILLON_SPIN_RAD_S_MAX,
    step: TOURBILLON_SPIN_RAD_S_STEP,
  },
  {
    key: 'radius_m',
    label: 'Spiral size',
    low: 'Tight',
    high: 'Wide',
    min: TOURBILLON_RADIUS_M_MIN,
    max: TOURBILLON_RADIUS_M_MAX,
    step: TOURBILLON_RADIUS_M_STEP,
  },
  {
    key: 'sparks',
    label: 'Density',
    low: 'Thin',
    high: 'Thick',
    min: TOURBILLON_SPARKS_MIN,
    max: TOURBILLON_SPARKS_MAX,
    step: TOURBILLON_SPARKS_STEP,
  },
] as const satisfies readonly RelativeControl[];
