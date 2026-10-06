/** Relative inspector bounds use the reference editor controls; stored fields retain renderer units. */
import type { Sound } from '@showcrafter/renderer/schema';
import type { RelativeControl } from './relative-control';
// Lift range and resolution in the named v1 field units; editor visual tuning.
const SOUND_LIFT_MIN = 0;
const SOUND_LIFT_MAX = 1;
const SOUND_LIFT_STEP = 0.01;
// Break range and resolution in the named v1 field units; editor visual tuning.
const SOUND_BREAK_MIN = 0;
const SOUND_BREAK_MAX = 1;
const SOUND_BREAK_STEP = 0.01;
// Crackle range and resolution in the named v1 field units; editor visual tuning.
const SOUND_CRACKLE_MIN = 0;
const SOUND_CRACKLE_MAX = 1;
const SOUND_CRACKLE_STEP = 0.01;
// Whistle range and resolution in the named v1 field units; editor visual tuning.
const SOUND_WHISTLE_MIN = 0;
const SOUND_WHISTLE_MAX = 1;
const SOUND_WHISTLE_STEP = 0.01;
/** Prototype relative controls for sound fields. */
export const SOUND_CONTROLS = [
  {
    key: 'lift',
    label: 'Lift',
    low: 'Quiet',
    high: 'Loud',
    min: SOUND_LIFT_MIN,
    max: SOUND_LIFT_MAX,
    step: SOUND_LIFT_STEP,
  },
  {
    key: 'break',
    label: 'Break',
    low: 'Quiet',
    high: 'Loud',
    min: SOUND_BREAK_MIN,
    max: SOUND_BREAK_MAX,
    step: SOUND_BREAK_STEP,
  },
  {
    key: 'crackle',
    label: 'Crackle',
    low: 'Quiet',
    high: 'Loud',
    min: SOUND_CRACKLE_MIN,
    max: SOUND_CRACKLE_MAX,
    step: SOUND_CRACKLE_STEP,
  },
  {
    key: 'whistle',
    label: 'Whistle',
    low: 'Quiet',
    high: 'Loud',
    min: SOUND_WHISTLE_MIN,
    max: SOUND_WHISTLE_MAX,
    step: SOUND_WHISTLE_STEP,
  },
] as const satisfies readonly RelativeControl<keyof Sound>[];
