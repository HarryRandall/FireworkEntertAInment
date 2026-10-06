/** Relative inspector bounds use the reference editor controls; stored fields retain renderer units. */
import type { Core, Fade, Break } from '@showcrafter/renderer/schema';
import type { RelativeControl } from './relative-control';
// Centre sparks range and resolution in the named v1 field units; editor visual tuning.
const CORE_COUNT_MIN = 20;
const CORE_COUNT_MAX = 300;
const CORE_COUNT_STEP = 5;
// Centre ring size range and resolution in the named v1 field units; editor visual tuning.
const CORE_RADIUS_MIN = 0.1;
const CORE_RADIUS_MAX = 1.5;
const CORE_RADIUS_STEP = 0.05;
// Flash strength range and resolution in the named v1 field units; editor visual tuning.
const CORE_FLASH_MIN = 0;
const CORE_FLASH_MAX = 2;
const CORE_FLASH_STEP = 0.05;
/** Prototype relative controls for core fields. */
export const CORE_CONTROLS = [
  {
    key: 'count',
    label: 'Centre sparks',
    low: 'Few',
    high: 'Many',
    min: CORE_COUNT_MIN,
    max: CORE_COUNT_MAX,
    step: CORE_COUNT_STEP,
  },
  {
    key: 'radius',
    label: 'Centre ring size',
    low: 'Small',
    high: 'Big',
    min: CORE_RADIUS_MIN,
    max: CORE_RADIUS_MAX,
    step: CORE_RADIUS_STEP,
  },
  {
    key: 'flash',
    label: 'Flash strength',
    low: 'Soft',
    high: 'Bright',
    min: CORE_FLASH_MIN,
    max: CORE_FLASH_MAX,
    step: CORE_FLASH_STEP,
  },
] as const satisfies readonly RelativeControl<keyof Core>[];
// White-hot range and resolution in the named v1 field units; editor visual tuning.
const FADE_WHITE_HOT_MIN = 0;
const FADE_WHITE_HOT_MAX = 0.4;
const FADE_WHITE_HOT_STEP = 0.01;
// Fade from range and resolution in the named v1 field units; editor visual tuning.
const FADE_FADE_AT_MIN = 0.3;
const FADE_FADE_AT_MAX = 0.95;
const FADE_FADE_AT_STEP = 0.01;
// Ember from range and resolution in the named v1 field units; editor visual tuning.
const FADE_EMBER_AT_MIN = 0;
const FADE_EMBER_AT_MAX = 1;
const FADE_EMBER_AT_STEP = 0.01;
/** Prototype relative controls for fade fields. */
export const FADE_CONTROLS = [
  {
    key: 'white_hot',
    label: 'White-hot',
    low: 'Brief',
    high: 'Long',
    min: FADE_WHITE_HOT_MIN,
    max: FADE_WHITE_HOT_MAX,
    step: FADE_WHITE_HOT_STEP,
  },
  {
    key: 'fade_at',
    label: 'Fade from',
    low: 'Early',
    high: 'Late',
    min: FADE_FADE_AT_MIN,
    max: FADE_FADE_AT_MAX,
    step: FADE_FADE_AT_STEP,
  },
  {
    key: 'ember_at',
    label: 'Ember from',
    low: 'Early',
    high: 'Late',
    min: FADE_EMBER_AT_MIN,
    max: FADE_EMBER_AT_MAX,
    step: FADE_EMBER_AT_STEP,
  },
] as const satisfies readonly RelativeControl<keyof Fade>[];
// Burst delay range and resolution in the named v1 field units; editor visual tuning.
const BREAK_AT_S_MIN = 0;
const BREAK_AT_S_MAX = 4;
const BREAK_AT_S_STEP = 0.05;
/** Prototype relative controls for break fields. */
export const BREAK_CONTROLS = [
  {
    key: 'at_s',
    label: 'Burst delay',
    low: 'Early',
    high: 'Late',
    min: BREAK_AT_S_MIN,
    max: BREAK_AT_S_MAX,
    step: BREAK_AT_S_STEP,
  },
] as const satisfies readonly RelativeControl<keyof Break>[];
