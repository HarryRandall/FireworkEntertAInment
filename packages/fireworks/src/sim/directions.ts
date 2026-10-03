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
const HEART_NORMALISER = 17;
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
 * @param k Particle index, dimensionless.
 * @param seed Design random seed, dimensionless.
 * @returns Cartesian direction with unit length.
 */
export function unit(k: number, seed: number): Vec3 {
  const z = 2 * hash(k, seed, UNIT_Z_HASH_STREAM) - 1,
    th = PROTOTYPE_TAU_RAD * hash(k, seed, UNIT_AZIMUTH_HASH_STREAM),
    r = Math.sqrt(1 - z * z);
  return [r * Math.cos(th), z, r * Math.sin(th)];
}

/**
 * Computes deterministic unit directions for a burst pattern.
 * @param n Number of directions.
 * @param pattern Stored pattern name.
 * @param seed Design random seed, dimensionless.
 * @param tilt Stored ring tilt, dimensionless.
 * @returns Direction vectors and per-star random values.
 */
export function directions(n: number, pattern: string, seed: number, tilt = 0): StarDirection[] {
  const out: StarDirection[] = [];
  const yaw =
    pattern === 'heart' || pattern === 'spiral'
      ? 0
      : hash(seed, PATTERN_YAW_HASH_STREAM, PATTERN_YAW_PHASE_STREAM) * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (pattern === 'ring') {
      const a = (i / n) * Math.PI * 2;
      x = Math.cos(a);
      const angle = (tilt * Math.PI) / 2 + RING_TILT_OFFSET_RAD;
      y = Math.sin(a) * Math.cos(angle);
      z = Math.sin(a) * Math.sin(angle);
    } else if (pattern === 'heart') {
      const a = (i / n) * Math.PI * 2;
      // Heart curve: the classic parametric outline, scaled to the prototype's unit radius.
      x = (HEART_X_COEFFICIENT * Math.sin(a) ** 3) / HEART_NORMALISER;
      y =
        (HEART_Y_PRIMARY_COEFFICIENT * Math.cos(a) -
          HEART_Y_SECOND_COEFFICIENT * Math.cos(2 * a) -
          2 * Math.cos(3 * a) -
          Math.cos(4 * a)) /
        HEART_NORMALISER;
      z = 0;
    } else if (pattern === 'spiral') {
      const u = (i + 0.5) / n,
        a = u * Math.PI * (SPIRAL_TURNS * 2) + (i % 2 ? Math.PI : 0);
      const radius = SPIRAL_INNER_RADIUS + u * SPIRAL_OUTER_RADIUS_DELTA;
      x = Math.cos(a) * radius;
      y = Math.sin(a) * radius;
      z = (hash(seed, i, SPIRAL_DEPTH_JITTER_STREAM) - 0.5) * SPIRAL_DEPTH_JITTER;
    } else if (pattern === 'cone') {
      const a = hash(seed, i, CONE_AZIMUTH_STREAM) * Math.PI * 2,
        s = Math.sqrt(hash(seed, i, CONE_RADIUS_STREAM)) * Math.sin(CONE_HALF_ANGLE_RAD);
      x = Math.cos(a) * s;
      z = Math.sin(a) * s;
      y = Math.sqrt(1 - s * s);
    } else if (pattern === 'bottom') {
      y = -1 + BOTTOM_VERTICAL_SPAN * ((i + 0.5) / n);
      const r = Math.sqrt(Math.max(0, 1 - y * y)),
        phi = i * GOLDEN_ANGLE_RAD;
      x = r * Math.cos(phi);
      z = r * Math.sin(phi);
    } else if (pattern === 'random') {
      z = 2 * hash(seed, i, RANDOM_LATITUDE_STREAM) - 1;
      const th = 2 * Math.PI * hash(seed, i, RANDOM_AZIMUTH_STREAM),
        r = Math.sqrt(1 - z * z);
      x = r * Math.cos(th);
      y = Math.abs(r * Math.sin(th)) * RANDOM_UPWARD_WEIGHT + RANDOM_UPWARD_BIAS;
      const l = Math.hypot(x, y, z);
      x /= l;
      y /= l;
      z /= l;
    } else {
      y = Math.max(
        -1,
        Math.min(
          1,
          1 -
            (2 * (i + 0.5)) / n +
            (hash(seed, i, SPHERE_LATITUDE_JITTER_STREAM) - 0.5) * (SPHERE_LATITUDE_JITTER / n),
        ),
      );
      const r = Math.sqrt(1 - y * y),
        phi =
          i * GOLDEN_ANGLE_RAD +
          (hash(seed, i, SPHERE_AZIMUTH_JITTER_STREAM) - 0.5) * SPHERE_AZIMUTH_JITTER_RAD;
      x = r * Math.cos(phi);
      z = r * Math.sin(phi);
    }
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw);
    out.push({
      x: x * cy + z * sy,
      y,
      z: -x * sy + z * cy,
      h: hash(seed, i, STAR_SPEED_VARIATION_STREAM),
      h2: hash(seed, i, STAR_SECONDARY_VARIATION_STREAM),
      ph: hash(seed, i, STAR_PHASE_STREAM) * PROTOTYPE_TAU_RAD,
    });
  }
  return out;
}
