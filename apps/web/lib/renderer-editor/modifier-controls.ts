/** Modifier controls expose only fields consumed by the renderer, with reference editor EFFECTS ranges. */
import type { Modifier } from '@showcrafter/renderer/schema';
import type { RelativeControl } from './relative-control';
/** Numeric settings read by motion, appearance, trail and child-event kernels. */
export type ModifierField =
  | 'at'
  | 'count'
  | 'rate_hz'
  | 'rate_rad_s'
  | 'angular_speed_rad_s'
  | 'amount'
  | 'gap';
// crackle starts: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const CRACKLE_AT_MIN = 0.2;
const CRACKLE_AT_MAX = 0.95;
const CRACKLE_AT_STEP = 0.01;
// crackle crackles: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const CRACKLE_COUNT_MIN = 3;
const CRACKLE_COUNT_MAX = 20;
const CRACKLE_COUNT_STEP = 1;
// crossette splits: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const CROSSETTE_AT_MIN = 0.15;
const CROSSETTE_AT_MAX = 0.8;
const CROSSETTE_AT_STEP = 0.01;
// crossette pieces: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const CROSSETTE_COUNT_MIN = 2;
const CROSSETTE_COUNT_MAX = 8;
const CROSSETTE_COUNT_STEP = 1;
// split splits: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const SPLIT_AT_MIN = 0.15;
const SPLIT_AT_MAX = 0.8;
const SPLIT_AT_STEP = 0.01;
// split pieces: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const SPLIT_COUNT_MIN = 2;
const SPLIT_COUNT_MAX = 8;
const SPLIT_COUNT_STEP = 1;
// strobe starts: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const STROBE_AT_MIN = 0.05;
const STROBE_AT_MAX = 0.8;
const STROBE_AT_STEP = 0.01;
// strobe flash rate: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const STROBE_RATE_HZ_MIN = 3;
const STROBE_RATE_HZ_MAX = 16;
const STROBE_RATE_HZ_STEP = 0.1;
// twinkle starts: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const TWINKLE_AT_MIN = 0.05;
const TWINKLE_AT_MAX = 0.8;
const TWINKLE_AT_STEP = 0.01;
// twinkle twinkle rate: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const TWINKLE_RATE_HZ_MIN = 1.5;
const TWINKLE_RATE_HZ_MAX = 28;
const TWINKLE_RATE_HZ_STEP = 0.1;
// pop pop size: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const POP_AMOUNT_MIN = 0.4;
const POP_AMOUNT_MAX = 2;
const POP_AMOUNT_STEP = 0.01;
// pop sparks: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const POP_COUNT_MIN = 4;
const POP_COUNT_MAX = 20;
const POP_COUNT_STEP = 1;
// ghost sweep: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const GHOST_AMOUNT_MIN = 0;
const GHOST_AMOUNT_MAX = 0.8;
const GHOST_AMOUNT_STEP = 0.01;
// ghost dark gap: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const GHOST_GAP_MIN = 0.04;
const GHOST_GAP_MAX = 0.3;
const GHOST_GAP_STEP = 0.01;
// fish wriggle: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const FISH_AMOUNT_MIN = 0.5;
const FISH_AMOUNT_MAX = 4;
const FISH_AMOUNT_STEP = 0.01;
// fish speed: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const FISH_RATE_RAD_S_MIN = 4;
const FISH_RATE_RAD_S_MAX = 18;
const FISH_RATE_RAD_S_STEP = 0.1;
// flutter swing: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const FLUTTER_AMOUNT_MIN = 0.3;
const FLUTTER_AMOUNT_MAX = 2.5;
const FLUTTER_AMOUNT_STEP = 0.01;
// twist curl: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const TWIST_ANGULAR_SPEED_RAD_S_MIN = 0.2;
const TWIST_ANGULAR_SPEED_RAD_S_MAX = 2;
const TWIST_ANGULAR_SPEED_RAD_S_STEP = 0.01;
// glitter starts: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const GLITTER_AT_MIN = 0.05;
const GLITTER_AT_MAX = 0.95;
const GLITTER_AT_STEP = 0.01;
// glitter glitter: range/step in v1 field units; editor visual tuning (glitter uses life fractions).
const GLITTER_AMOUNT_MIN = 0;
const GLITTER_AMOUNT_MAX = 1;
const GLITTER_AMOUNT_STEP = 0.01;
/** Controls keyed by every stored modifier kind; empty rows mean no consumed numeric setting. */
export const MODIFIER_CONTROLS: Readonly<
  Record<Modifier['kind'], readonly RelativeControl<ModifierField>[]>
> = {
  crackle: [
    {
      key: 'at',
      label: 'Starts',
      low: 'Early',
      high: 'Late',
      min: CRACKLE_AT_MIN,
      max: CRACKLE_AT_MAX,
      step: CRACKLE_AT_STEP,
    },
    {
      key: 'count',
      label: 'Crackles',
      low: 'Few',
      high: 'Lots',
      min: CRACKLE_COUNT_MIN,
      max: CRACKLE_COUNT_MAX,
      step: CRACKLE_COUNT_STEP,
    },
  ],
  crossette: [
    {
      key: 'at',
      label: 'Splits',
      low: 'Early',
      high: 'Late',
      min: CROSSETTE_AT_MIN,
      max: CROSSETTE_AT_MAX,
      step: CROSSETTE_AT_STEP,
    },
    {
      key: 'count',
      label: 'Pieces',
      low: 'Few',
      high: 'Many',
      min: CROSSETTE_COUNT_MIN,
      max: CROSSETTE_COUNT_MAX,
      step: CROSSETTE_COUNT_STEP,
    },
  ],
  split: [
    {
      key: 'at',
      label: 'Splits',
      low: 'Early',
      high: 'Late',
      min: SPLIT_AT_MIN,
      max: SPLIT_AT_MAX,
      step: SPLIT_AT_STEP,
    },
    {
      key: 'count',
      label: 'Pieces',
      low: 'Few',
      high: 'Many',
      min: SPLIT_COUNT_MIN,
      max: SPLIT_COUNT_MAX,
      step: SPLIT_COUNT_STEP,
    },
  ],
  strobe: [
    {
      key: 'at',
      label: 'Starts',
      low: 'Early',
      high: 'Late',
      min: STROBE_AT_MIN,
      max: STROBE_AT_MAX,
      step: STROBE_AT_STEP,
    },
    {
      key: 'rate_hz',
      label: 'Flash rate',
      low: 'Slow',
      high: 'Rapid',
      min: STROBE_RATE_HZ_MIN,
      max: STROBE_RATE_HZ_MAX,
      step: STROBE_RATE_HZ_STEP,
    },
  ],
  twinkle: [
    {
      key: 'at',
      label: 'Starts',
      low: 'Early',
      high: 'Late',
      min: TWINKLE_AT_MIN,
      max: TWINKLE_AT_MAX,
      step: TWINKLE_AT_STEP,
    },
    {
      key: 'rate_hz',
      label: 'Twinkle rate',
      low: 'Slow',
      high: 'Rapid',
      min: TWINKLE_RATE_HZ_MIN,
      max: TWINKLE_RATE_HZ_MAX,
      step: TWINKLE_RATE_HZ_STEP,
    },
  ],
  pop: [
    {
      key: 'amount',
      label: 'Pop size',
      low: 'Small',
      high: 'Big',
      min: POP_AMOUNT_MIN,
      max: POP_AMOUNT_MAX,
      step: POP_AMOUNT_STEP,
    },
    {
      key: 'count',
      label: 'Sparks',
      low: 'Few',
      high: 'Many',
      min: POP_COUNT_MIN,
      max: POP_COUNT_MAX,
      step: POP_COUNT_STEP,
    },
  ],
  ghost: [
    {
      key: 'amount',
      label: 'Sweep',
      low: 'All at once',
      high: 'Slow',
      min: GHOST_AMOUNT_MIN,
      max: GHOST_AMOUNT_MAX,
      step: GHOST_AMOUNT_STEP,
    },
    {
      key: 'gap',
      label: 'Dark gap',
      low: 'Blink',
      high: 'Long',
      min: GHOST_GAP_MIN,
      max: GHOST_GAP_MAX,
      step: GHOST_GAP_STEP,
    },
  ],
  fish: [
    {
      key: 'amount',
      label: 'Wriggle',
      low: 'Gentle',
      high: 'Wild',
      min: FISH_AMOUNT_MIN,
      max: FISH_AMOUNT_MAX,
      step: FISH_AMOUNT_STEP,
    },
    {
      key: 'rate_rad_s',
      label: 'Speed',
      low: 'Slow',
      high: 'Fast',
      min: FISH_RATE_RAD_S_MIN,
      max: FISH_RATE_RAD_S_MAX,
      step: FISH_RATE_RAD_S_STEP,
    },
  ],
  flutter: [
    {
      key: 'amount',
      label: 'Swing',
      low: 'Gentle',
      high: 'Wide',
      min: FLUTTER_AMOUNT_MIN,
      max: FLUTTER_AMOUNT_MAX,
      step: FLUTTER_AMOUNT_STEP,
    },
  ],
  bees: [],
  twist: [
    {
      key: 'angular_speed_rad_s',
      label: 'Curl',
      low: 'Gentle',
      high: 'Tight',
      min: TWIST_ANGULAR_SPEED_RAD_S_MIN,
      max: TWIST_ANGULAR_SPEED_RAD_S_MAX,
      step: TWIST_ANGULAR_SPEED_RAD_S_STEP,
    },
  ],
  glitter: [
    {
      key: 'at',
      label: 'Starts',
      low: 'Early',
      high: 'Late',
      min: GLITTER_AT_MIN,
      max: GLITTER_AT_MAX,
      step: GLITTER_AT_STEP,
    },
    {
      key: 'amount',
      label: 'Glitter',
      low: 'None',
      high: 'Lots',
      min: GLITTER_AMOUNT_MIN,
      max: GLITTER_AMOUNT_MAX,
      step: GLITTER_AMOUNT_STEP,
    },
  ],
  whistle: [],
};
