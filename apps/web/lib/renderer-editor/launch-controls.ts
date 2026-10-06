/** Relative inspector bounds use the reference editor controls; stored fields retain renderer units. */
import type { Launch } from '@showcrafter/renderer/schema';
import type { RelativeControl } from './relative-control';
// Height range and resolution in the named v1 field units; editor visual tuning.
const LAUNCH_HEIGHT_M_MIN = 20;
const LAUNCH_HEIGHT_M_MAX = 140;
const LAUNCH_HEIGHT_M_STEP = 1;
// Climb time range and resolution in the named v1 field units; editor visual tuning.
const LAUNCH_TIME_S_MIN = 0.6;
const LAUNCH_TIME_S_MAX = 4;
const LAUNCH_TIME_S_STEP = 0.05;
// Smoke range and resolution in the named v1 field units; editor visual tuning.
const LAUNCH_SMOKE_MIN = 0;
const LAUNCH_SMOKE_MAX = 2;
const LAUNCH_SMOKE_STEP = 0.1;
// Lean range and resolution in the named v1 field units; editor visual tuning.
const LAUNCH_TILT_DEG_MIN = -30;
const LAUNCH_TILT_DEG_MAX = 30;
const LAUNCH_TILT_DEG_STEP = 1;
// Tail density range and resolution in the named v1 field units; editor visual tuning.
const LAUNCH_SPARKS_MIN = 0;
const LAUNCH_SPARKS_MAX = 400;
const LAUNCH_SPARKS_STEP = 10;
// Tail spread range and resolution in the named v1 field units; editor visual tuning.
const LAUNCH_SPREAD_MIN = 0.2;
const LAUNCH_SPREAD_MAX = 3;
const LAUNCH_SPREAD_STEP = 0.1;
/** Prototype relative controls for launch fields. */
export const LAUNCH_CONTROLS = [
  {
    key: 'height_m',
    label: 'Height',
    low: 'Low',
    high: 'High',
    min: LAUNCH_HEIGHT_M_MIN,
    max: LAUNCH_HEIGHT_M_MAX,
    step: LAUNCH_HEIGHT_M_STEP,
  },
  {
    key: 'time_s',
    label: 'Climb time',
    low: 'Fast',
    high: 'Slow',
    min: LAUNCH_TIME_S_MIN,
    max: LAUNCH_TIME_S_MAX,
    step: LAUNCH_TIME_S_STEP,
  },
  {
    key: 'smoke',
    label: 'Smoke',
    low: 'None',
    high: 'Heavy',
    min: LAUNCH_SMOKE_MIN,
    max: LAUNCH_SMOKE_MAX,
    step: LAUNCH_SMOKE_STEP,
  },
  {
    key: 'tilt_deg',
    label: 'Lean',
    low: 'Left',
    high: 'Right',
    min: LAUNCH_TILT_DEG_MIN,
    max: LAUNCH_TILT_DEG_MAX,
    step: LAUNCH_TILT_DEG_STEP,
  },
  {
    key: 'sparks',
    label: 'Tail density',
    low: 'Thin',
    high: 'Thick',
    min: LAUNCH_SPARKS_MIN,
    max: LAUNCH_SPARKS_MAX,
    step: LAUNCH_SPARKS_STEP,
  },
  {
    key: 'spread',
    label: 'Tail spread',
    low: 'Narrow',
    high: 'Wide',
    min: LAUNCH_SPREAD_MIN,
    max: LAUNCH_SPREAD_MAX,
    step: LAUNCH_SPREAD_STEP,
  },
] as const satisfies readonly RelativeControl<keyof Launch>[];
