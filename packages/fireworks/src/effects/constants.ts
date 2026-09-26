import * as THREE from 'three';
import type { FireworkDesign } from '../design.ts';

export const PATTERN_SEED: Record<FireworkDesign['pattern'], 1 | 2 | 3> = {
  fibonacci: 1,
  wave: 2,
  strobe: 3,
};

export const STAR_DRAG = 2.15;

export const TRAIL_DRAG = 2.55;

export const MIN_STAR_GRAVITY = -2;

export const MAX_STAR_GRAVITY = 1;

export const TRAIL_GRAVITY = -0.03;

export const SHELL_TRAIL_DENSITY = 0.68;

export const LIFT_SPARK_COLOR = new THREE.Color(1, 0.76, 0.38);

export const HOT_SPARK_COLOR = new THREE.Color(1, 0.92, 0.72);

export const CRACKLE_TOTAL_FRAGMENT_BUDGET = 24_000;

export const CRACKLE_TOTAL_SOUND_BUDGET = 8;

export const STAR_LIFE_RANDOMNESS_REFERENCE_SECONDS = 0.6;

export const SHELL_TRAIL_SPREAD_SCALE = 0.035;

export const SHELL_TRAIL_CLEAR_AGE_START = 0.06;

export const SHELL_TRAIL_CLEAR_AGE_END = 0.24;

export const LIFT_SWIRL_START_AGE = 0.16;

export const LIFT_SWIRL_FULL_AGE = 0.36;

export const LIFT_LOOP_MIN_SPAN = 0.05;

export const BURST_TRAIL_MAX_SPREAD_ANGLE = 80;

export const BURST_TRAIL_SPREAD_SCALE = 0.055;

export const BURST_TRAIL_MAX_SPREAD = 180;

/** Hot/cool ends of the named streak-trail palettes. */
export const GOLD_TRAIL_HOT = new THREE.Color(1, 0.9, 0.62);

export const GOLD_TRAIL_COOL = new THREE.Color(1, 0.45, 0.15);

export const SILVER_TRAIL_HOT = new THREE.Color(0.94, 0.97, 1);

export const SILVER_TRAIL_COOL = new THREE.Color(0.5, 0.58, 0.72);

export const EMBER_TRAIL_HOT = new THREE.Color(1, 0.62, 0.26);

export const EMBER_TRAIL_COOL = new THREE.Color(0.62, 0.24, 0.08);
