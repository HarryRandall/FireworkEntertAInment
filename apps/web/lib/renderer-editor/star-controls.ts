/** Relative inspector bounds use the reference editor controls; stored fields retain renderer units. */
import type { Layer } from '@showcrafter/renderer/schema';
import type { RelativeControl } from './relative-control';
// Size range and resolution in the named v1 field units; editor visual tuning.
const STARS_RADIUS_M_MIN = 6;
const STARS_RADIUS_M_MAX = 45;
const STARS_RADIUS_M_STEP = 1;
// Count range and resolution in the named v1 field units; editor visual tuning.
const STARS_COUNT_MIN = 6;
const STARS_COUNT_MAX = 200;
const STARS_COUNT_STEP = 1;
// Spread range and resolution in the named v1 field units; editor visual tuning.
const STARS_SPEED_VAR_MIN = 0;
const STARS_SPEED_VAR_MAX = 0.6;
const STARS_SPEED_VAR_STEP = 0.01;
// Burn range and resolution in the named v1 field units; editor visual tuning.
const STARS_LIFE_S_MIN = 0.6;
const STARS_LIFE_S_MAX = 5;
const STARS_LIFE_S_STEP = 0.1;
// Droop range and resolution in the named v1 field units; editor visual tuning.
const STARS_GRAVITY_M_S2_MIN = 0;
const STARS_GRAVITY_M_S2_MAX = 14;
const STARS_GRAVITY_M_S2_STEP = 0.5;
// Air drag range and resolution in the named v1 field units; editor visual tuning.
const STARS_DRAG_PER_S_MIN = 0.5;
const STARS_DRAG_PER_S_MAX = 4;
const STARS_DRAG_PER_S_STEP = 0.1;
// Burn spread range and resolution in the named v1 field units; editor visual tuning.
const STARS_LIFE_VAR_MIN = 0;
const STARS_LIFE_VAR_MAX = 0.8;
const STARS_LIFE_VAR_STEP = 0.01;
// Delay range and resolution in the named v1 field units; editor visual tuning.
const STARS_DELAY_S_MIN = 0;
const STARS_DELAY_S_MAX = 1.5;
const STARS_DELAY_S_STEP = 0.05;
/** Prototype relative controls for stars fields. */
export const STARS_CONTROLS = [
  {
    key: 'radius_m',
    label: 'Size',
    low: 'Small',
    high: 'Big',
    min: STARS_RADIUS_M_MIN,
    max: STARS_RADIUS_M_MAX,
    step: STARS_RADIUS_M_STEP,
  },
  {
    key: 'count',
    label: 'Count',
    low: 'Few',
    high: 'Many',
    min: STARS_COUNT_MIN,
    max: STARS_COUNT_MAX,
    step: STARS_COUNT_STEP,
  },
  {
    key: 'speed_var',
    label: 'Spread',
    low: 'Together',
    high: 'Scattered',
    min: STARS_SPEED_VAR_MIN,
    max: STARS_SPEED_VAR_MAX,
    step: STARS_SPEED_VAR_STEP,
  },
  {
    key: 'life_s',
    label: 'Burn',
    low: 'Short',
    high: 'Long',
    min: STARS_LIFE_S_MIN,
    max: STARS_LIFE_S_MAX,
    step: STARS_LIFE_S_STEP,
  },
  {
    key: 'gravity_m_s2',
    label: 'Droop',
    low: 'Floaty',
    high: 'Heavy',
    min: STARS_GRAVITY_M_S2_MIN,
    max: STARS_GRAVITY_M_S2_MAX,
    step: STARS_GRAVITY_M_S2_STEP,
  },
  {
    key: 'drag_per_s',
    label: 'Air drag',
    low: 'Floaty',
    high: 'Heavy',
    min: STARS_DRAG_PER_S_MIN,
    max: STARS_DRAG_PER_S_MAX,
    step: STARS_DRAG_PER_S_STEP,
  },
  {
    key: 'life_var',
    label: 'Burn spread',
    low: 'Together',
    high: 'Staggered',
    min: STARS_LIFE_VAR_MIN,
    max: STARS_LIFE_VAR_MAX,
    step: STARS_LIFE_VAR_STEP,
  },
  {
    key: 'delay_s',
    label: 'Delay',
    low: 'Early',
    high: 'Late',
    min: STARS_DELAY_S_MIN,
    max: STARS_DELAY_S_MAX,
    step: STARS_DELAY_S_STEP,
  },
] as const satisfies readonly RelativeControl<keyof Layer>[];
// Head size range and resolution in the named v1 field units; editor visual tuning.
const HEAD_SIZE_MIN = 0.3;
const HEAD_SIZE_MAX = 3;
const HEAD_SIZE_STEP = 0.05;
/** Prototype relative controls for head fields. */
export const HEAD_CONTROLS = [
  {
    key: 'size',
    label: 'Head size',
    low: 'Fine',
    high: 'Bold',
    min: HEAD_SIZE_MIN,
    max: HEAD_SIZE_MAX,
    step: HEAD_SIZE_STEP,
  },
] as const satisfies readonly RelativeControl<keyof Layer['head']>[];
