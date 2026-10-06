/** Deterministic burst-direction patterns used by shell and ground simulations. */
import { hash } from './random';
import type { Vec3 } from './colour';

// Prototype tuning: the reference uses this rounded full-turn value for particle phases, in radians.
const PROTOTYPE_TAU_RAD = 6.2832;
// Prototype tuning: hash stream selectors keep independently sampled direction properties decorrelated.
const UNIT_Z_HASH_STREAM = 31;
const UNIT_AZIMUTH_HASH_STREAM = 32;
const PATTERN_YAW_HASH_STREAM = 91;
const PATTERN_YAW_PHASE_STREAM = 3;
const SPIRAL_DEPTH_JITTER_STREAM = 8;
const CONE_AZIMUTH_STREAM = 1;
const CONE_RADIUS_STREAM = 2;
const RANDOM_LATITUDE_STREAM = 1;
const RANDOM_AZIMUTH_STREAM = 2;
const SPHERE_LATITUDE_JITTER_STREAM = 8;
const SPHERE_AZIMUTH_JITTER_STREAM = 7;
const STAR_SPEED_VARIATION_STREAM = 3;
const STAR_SECONDARY_VARIATION_STREAM = 4;
const STAR_PHASE_STREAM = 5;
// Prototype visual tuning: ring tilt has this fixed radian offset in addition to the stored control.
const RING_TILT_OFFSET_RAD = 0.3;
// Classic parametric-heart coefficients, normalised by the prototype's unit-radius scale.
const HEART_X_COEFFICIENT = 16;
const HEART_Y_PRIMARY_COEFFICIENT = 13;
const HEART_Y_SECOND_COEFFICIENT = 5;
// Classic heart third-harmonic weight, dimensionless amplitude.
const HEART_Y_THIRD_COEFFICIENT = 2;
const HEART_NORMALISER = 17;
// Classic heart equation: cubic x term and third/fourth cosine harmonics, dimensionless.
const HEART_CUBIC_POWER = 3;
const HEART_THIRD_HARMONIC = 3;
const HEART_FOURTH_HARMONIC = 4;
// Prototype visual tuning: two spiral arms make two-and-a-half turns from centre to rim.
const SPIRAL_TURNS = 2.5;
const SPIRAL_INNER_RADIUS = 0.12;
const SPIRAL_OUTER_RADIUS_DELTA = 0.88;
const SPIRAL_DEPTH_JITTER = 0.1;
// Prototype visual tuning: the mine cone opens by this angle, in radians.
const CONE_HALF_ANGLE_RAD = 0.42;
// Mathematics: the golden angle distributes bottom and sphere samples without aligned rows, in radians.
const GOLDEN_ANGLE_RAD = 2.399963;
// Prototype visual tuning: bottom patterns cover this vertical unit-vector span.
const BOTTOM_VERTICAL_SPAN = 1.25;
const RANDOM_UPWARD_WEIGHT = 0.7;
const RANDOM_UPWARD_BIAS = 0.2;
const SPHERE_LATITUDE_JITTER = 2.4;
const SPHERE_AZIMUTH_JITTER_RAD = 0.9;
export interface StarDirection {
  /** Unit-vector horizontal x component used by closed-form star motion. */
  x: number;
  /** Unit-vector vertical y component used by closed-form star motion. */
  y: number;
  /** Unit-vector horizontal z component used by closed-form star motion. */
  z: number;
  /** Deterministic [0, 1) sample for speed and palette variation. */
  h: number;
  /** Deterministic [0, 1) sample for brightness and lifetime variation. */
  h2: number;
  /** Deterministic phase in radians for periodic motion and flicker. */
  ph: number;
}

/**
 * Computes a deterministic uniformly distributed unit vector.
 * @param index - Particle index, dimensionless.
 * @param seed - Design random seed, dimensionless.
 * @returns Cartesian direction with unit length.
 */
export function unit(index: number, seed: number): Vec3 {
  const z = 2 * hash(index, seed, UNIT_Z_HASH_STREAM) - 1;
  const azimuthRad = PROTOTYPE_TAU_RAD * hash(index, seed, UNIT_AZIMUTH_HASH_STREAM);
  const crossSectionRadius = Math.sqrt(1 - z * z);
  return [crossSectionRadius * Math.cos(azimuthRad), z, crossSectionRadius * Math.sin(azimuthRad)];
}

/**
 * Computes deterministic unit directions for a burst pattern.
 * @param count - Number of directions.
 * @param pattern - Stored pattern name.
 * @param seed - Design random seed, dimensionless.
 * @param tilt - Stored ring tilt, dimensionless.
 * @returns Direction vectors and per-star random values.
 */
export function directions(
  count: number,
  pattern: string,
  seed: number,
  tilt = 0,
): StarDirection[] {
  const out: StarDirection[] = [];
  const yaw =
    pattern === 'heart' || pattern === 'spiral'
      ? 0
      : hash(seed, PATTERN_YAW_HASH_STREAM, PATTERN_YAW_PHASE_STREAM) * Math.PI * 2;
  const scratch: DirectionScratch = { index: 0, count, seed, tilt, x: 0, y: 0, z: 0 };
  for (let index = 0; index < count; index++) {
    scratch.index = index;
    patternDirection(scratch, pattern);
    const { x, y, z } = scratch;
    const yawCosine = Math.cos(yaw);
    const yawSine = Math.sin(yaw);
    out.push({
      x: x * yawCosine + z * yawSine,
      y,
      z: -x * yawSine + z * yawCosine,
      h: hash(seed, index, STAR_SPEED_VARIATION_STREAM),
      h2: hash(seed, index, STAR_SECONDARY_VARIATION_STREAM),
      ph: hash(seed, index, STAR_PHASE_STREAM) * PROTOTYPE_TAU_RAD,
    });
  }
  return out;
}

// One mutable workspace per direction set, reused by every pattern sample.
interface DirectionScratch {
  index: number;
  count: number;
  seed: number;
  tilt: number;
  x: number;
  y: number;
  z: number;
}
function patternDirection(state: DirectionScratch, pattern: string): void {
  switch (pattern) {
    case 'ring': {
      ringDirection(state);
      return;
    }
    case 'heart': {
      heartDirection(state);
      return;
    }
    case 'spiral': {
      spiralDirection(state);
      return;
    }
    case 'cone': {
      coneDirection(state);
      return;
    }
    case 'bottom': {
      bottomDirection(state);
      return;
    }
    case 'random': {
      randomDirection(state);
      return;
    }
    default: {
      sphereDirection(state);
      return;
    }
  }
}
function ringDirection(state: DirectionScratch): void {
  const { index, count, tilt } = state;

  const angleRad = (index / count) * Math.PI * 2;
  state.x = Math.cos(angleRad);
  const angle = (tilt * Math.PI) / 2 + RING_TILT_OFFSET_RAD;
  state.y = Math.sin(angleRad) * Math.cos(angle);
  state.z = Math.sin(angleRad) * Math.sin(angle);
}
function heartDirection(state: DirectionScratch): void {
  const { index, count } = state;

  const angleRad = (index / count) * Math.PI * 2;
  // Heart curve: the classic parametric outline, scaled to the prototype's unit radius.
  state.x = (HEART_X_COEFFICIENT * Math.sin(angleRad) ** HEART_CUBIC_POWER) / HEART_NORMALISER;
  state.y =
    (HEART_Y_PRIMARY_COEFFICIENT * Math.cos(angleRad) -
      HEART_Y_SECOND_COEFFICIENT * Math.cos(2 * angleRad) -
      HEART_Y_THIRD_COEFFICIENT * Math.cos(HEART_THIRD_HARMONIC * angleRad) -
      Math.cos(HEART_FOURTH_HARMONIC * angleRad)) /
    HEART_NORMALISER;
  state.z = 0;
}
function spiralDirection(state: DirectionScratch): void {
  const { index, count, seed } = state;

  const progress = (index + 0.5) / count;
  const angleRad = progress * Math.PI * (SPIRAL_TURNS * 2) + (index % 2 !== 0 ? Math.PI : 0);
  const radius = SPIRAL_INNER_RADIUS + progress * SPIRAL_OUTER_RADIUS_DELTA;
  state.x = Math.cos(angleRad) * radius;
  state.y = Math.sin(angleRad) * radius;
  state.z = (hash(seed, index, SPIRAL_DEPTH_JITTER_STREAM) - 0.5) * SPIRAL_DEPTH_JITTER;
}
function coneDirection(state: DirectionScratch): void {
  const { index, seed } = state;

  const angleRad = hash(seed, index, CONE_AZIMUTH_STREAM) * Math.PI * 2;
  const coneRadius =
    Math.sqrt(hash(seed, index, CONE_RADIUS_STREAM)) * Math.sin(CONE_HALF_ANGLE_RAD);
  state.x = Math.cos(angleRad) * coneRadius;
  state.z = Math.sin(angleRad) * coneRadius;
  state.y = Math.sqrt(1 - coneRadius * coneRadius);
}
function bottomDirection(state: DirectionScratch): void {
  const { index, count } = state;

  state.y = -1 + BOTTOM_VERTICAL_SPAN * ((index + 0.5) / count);
  const crossSectionRadius = Math.sqrt(Math.max(0, 1 - state.y * state.y));
  const azimuthRad = index * GOLDEN_ANGLE_RAD;
  state.x = crossSectionRadius * Math.cos(azimuthRad);
  state.z = crossSectionRadius * Math.sin(azimuthRad);
}
function randomDirection(state: DirectionScratch): void {
  const { index, seed } = state;

  state.z = 2 * hash(seed, index, RANDOM_LATITUDE_STREAM) - 1;
  const azimuthRad = 2 * Math.PI * hash(seed, index, RANDOM_AZIMUTH_STREAM);
  const crossSectionRadius = Math.sqrt(1 - state.z * state.z);
  state.x = crossSectionRadius * Math.cos(azimuthRad);
  state.y =
    Math.abs(crossSectionRadius * Math.sin(azimuthRad)) * RANDOM_UPWARD_WEIGHT + RANDOM_UPWARD_BIAS;
  const vectorLength = Math.hypot(state.x, state.y, state.z);
  state.x /= vectorLength;
  state.y /= vectorLength;
  state.z /= vectorLength;
}
function sphereDirection(state: DirectionScratch): void {
  const { index, count, seed } = state;

  state.y = Math.max(
    -1,
    Math.min(
      1,
      1 -
        (2 * (index + 0.5)) / count +
        (hash(seed, index, SPHERE_LATITUDE_JITTER_STREAM) - 0.5) * (SPHERE_LATITUDE_JITTER / count),
    ),
  );
  const crossSectionRadius = Math.sqrt(1 - state.y * state.y);
  const azimuthRad =
    index * GOLDEN_ANGLE_RAD +
    (hash(seed, index, SPHERE_AZIMUTH_JITTER_STREAM) - 0.5) * SPHERE_AZIMUTH_JITTER_RAD;
  state.x = crossSectionRadius * Math.cos(azimuthRad);
  state.z = crossSectionRadius * Math.sin(azimuthRad);
}
