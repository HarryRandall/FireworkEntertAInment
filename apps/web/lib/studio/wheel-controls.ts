/** Ground controls map the prototype relative interactions onto each v1 emitter. */
import type { RelativeControl } from './relative-control';
// wheel duration: v1 field-unit bounds/step, visual tuning around the prototype presets.
const WHEEL_DURATION_S_MIN = 1;
const WHEEL_DURATION_S_MAX = 20;
const WHEEL_DURATION_S_STEP = 0.1;
// wheel spin: v1 field-unit bounds/step, visual tuning around the prototype presets.
const WHEEL_SPIN_HZ_MIN = 0;
const WHEEL_SPIN_HZ_MAX = 10;
const WHEEL_SPIN_HZ_STEP = 0.1;
// wheel size: v1 field-unit bounds/step, visual tuning around the prototype presets.
const WHEEL_RADIUS_M_MIN = 0.1;
const WHEEL_RADIUS_M_MAX = 3;
const WHEEL_RADIUS_M_STEP = 0.05;
// wheel density: v1 field-unit bounds/step, visual tuning around the prototype presets.
const WHEEL_SPARKS_MIN = 0;
const WHEEL_SPARKS_MAX = 200;
const WHEEL_SPARKS_STEP = 1;
// wheel drivers: v1 field-unit bounds/step, visual tuning around the prototype presets.
const WHEEL_DRIVERS_MIN = 1;
const WHEEL_DRIVERS_MAX = 10;
const WHEEL_DRIVERS_STEP = 1;
// wheel glitter: v1 field-unit bounds/step, visual tuning around the prototype presets.
const WHEEL_GLITTER_MIN = 0;
const WHEEL_GLITTER_MAX = 1;
const WHEEL_GLITTER_STEP = 0.05;
/** Relative wheel controls, retaining authored units. */
export const WHEEL_CONTROLS = [
  {
    key: 'duration_s',
    label: 'Duration',
    low: 'Short',
    high: 'Long',
    min: WHEEL_DURATION_S_MIN,
    max: WHEEL_DURATION_S_MAX,
    step: WHEEL_DURATION_S_STEP,
  },
  {
    key: 'spin_hz',
    label: 'Spin',
    low: 'Gentle',
    high: 'Fast',
    min: WHEEL_SPIN_HZ_MIN,
    max: WHEEL_SPIN_HZ_MAX,
    step: WHEEL_SPIN_HZ_STEP,
  },
  {
    key: 'radius_m',
    label: 'Size',
    low: 'Small',
    high: 'Big',
    min: WHEEL_RADIUS_M_MIN,
    max: WHEEL_RADIUS_M_MAX,
    step: WHEEL_RADIUS_M_STEP,
  },
  {
    key: 'sparks',
    label: 'Density',
    low: 'Thin',
    high: 'Thick',
    min: WHEEL_SPARKS_MIN,
    max: WHEEL_SPARKS_MAX,
    step: WHEEL_SPARKS_STEP,
  },
  {
    key: 'drivers',
    label: 'Drivers',
    low: 'Few',
    high: 'Many',
    min: WHEEL_DRIVERS_MIN,
    max: WHEEL_DRIVERS_MAX,
    step: WHEEL_DRIVERS_STEP,
  },
  {
    key: 'glitter',
    label: 'Glitter',
    low: 'None',
    high: 'Lots',
    min: WHEEL_GLITTER_MIN,
    max: WHEEL_GLITTER_MAX,
    step: WHEEL_GLITTER_STEP,
  },
] as const satisfies readonly RelativeControl[];
