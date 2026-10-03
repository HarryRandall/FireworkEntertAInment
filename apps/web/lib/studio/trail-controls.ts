/** Relative inspector bounds use the prototype controls; stored fields retain renderer units. */
import type { Trail } from '@showcrafter/fireworks/schema';
import type { RelativeControl } from './relative-control';
// Length range and resolution in the named v1 field units, from studio.html/editor.html.
const TRAIL_LENGTH_S_MIN = 0.05;
const TRAIL_LENGTH_S_MAX = 2;
const TRAIL_LENGTH_S_STEP = 0.05;
// Density range and resolution in the named v1 field units, from studio.html/editor.html.
const TRAIL_SPARKS_MIN = 1;
const TRAIL_SPARKS_MAX = 60;
const TRAIL_SPARKS_STEP = 1;
// Spray range and resolution in the named v1 field units, from studio.html/editor.html.
const TRAIL_SPREAD_M_S_MIN = 0.2;
const TRAIL_SPREAD_M_S_MAX = 4;
const TRAIL_SPREAD_M_S_STEP = 0.1;
// Glitter range and resolution in the named v1 field units, from studio.html/editor.html.
const TRAIL_GLITTER_MIN = 0;
const TRAIL_GLITTER_MAX = 1;
const TRAIL_GLITTER_STEP = 0.05;
// Spark fall range and resolution in the named v1 field units, from studio.html/editor.html.
const TRAIL_GRAVITY_M_S2_MIN = 0;
const TRAIL_GRAVITY_M_S2_MAX = 12;
const TRAIL_GRAVITY_M_S2_STEP = 0.1;
// Spark size range and resolution in the named v1 field units, from studio.html/editor.html.
const TRAIL_SIZE_MIN = 0.4;
const TRAIL_SIZE_MAX = 2;
const TRAIL_SIZE_STEP = 0.05;
// Flicker range and resolution in the named v1 field units, from studio.html/editor.html.
const TRAIL_FLICKER_MIN = 0;
const TRAIL_FLICKER_MAX = 1;
const TRAIL_FLICKER_STEP = 0.01;
/** Prototype relative controls for trail fields. */
export const TRAIL_CONTROLS = [
  {
    key: 'length_s',
    label: 'Length',
    low: 'Short',
    high: 'Long',
    min: TRAIL_LENGTH_S_MIN,
    max: TRAIL_LENGTH_S_MAX,
    step: TRAIL_LENGTH_S_STEP,
  },
  {
    key: 'sparks',
    label: 'Density',
    low: 'Thin',
    high: 'Thick',
    min: TRAIL_SPARKS_MIN,
    max: TRAIL_SPARKS_MAX,
    step: TRAIL_SPARKS_STEP,
  },
  {
    key: 'spread_m_s',
    label: 'Spray',
    low: 'Narrow',
    high: 'Wide',
    min: TRAIL_SPREAD_M_S_MIN,
    max: TRAIL_SPREAD_M_S_MAX,
    step: TRAIL_SPREAD_M_S_STEP,
  },
  {
    key: 'glitter',
    label: 'Glitter',
    low: 'None',
    high: 'Lots',
    min: TRAIL_GLITTER_MIN,
    max: TRAIL_GLITTER_MAX,
    step: TRAIL_GLITTER_STEP,
  },
  {
    key: 'gravity_m_s2',
    label: 'Spark fall',
    low: 'Floaty',
    high: 'Heavy',
    min: TRAIL_GRAVITY_M_S2_MIN,
    max: TRAIL_GRAVITY_M_S2_MAX,
    step: TRAIL_GRAVITY_M_S2_STEP,
  },
  {
    key: 'size',
    label: 'Spark size',
    low: 'Fine',
    high: 'Chunky',
    min: TRAIL_SIZE_MIN,
    max: TRAIL_SIZE_MAX,
    step: TRAIL_SIZE_STEP,
  },
  {
    key: 'flicker',
    label: 'Flicker',
    low: 'Steady',
    high: 'Sparkly',
    min: TRAIL_FLICKER_MIN,
    max: TRAIL_FLICKER_MAX,
    step: TRAIL_FLICKER_STEP,
  },
] as const satisfies readonly RelativeControl<keyof Trail>[];
